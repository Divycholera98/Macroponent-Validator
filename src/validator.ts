import { DOMParser } from '@xmldom/xmldom';

export interface ValidationIssue {
    severity: 'error' | 'warning';
    message: string;
    detail?: string;
    line: number;
    startChar: number;
    endChar: number;
    suggestedFix?: string;
}

export interface ValidationResult {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    highlightMap: Map<number, 'error' | 'warning'>;
}

const REQUIRED_TAGS = [
    'associated_types', 'bundles', 'category', 'component_dependencies',
    'composition', 'da_relay_models', 'data', 'description',
    'dispatched_events', 'ext_controller_dep', 'extends', 'extension_point',
    'handled_events', 'interactions', 'interfaces', 'internal_event_mappings',
    'layout', 'macroponent_dependencies', 'name', 'output_prop_mapping',
    'props', 'required_translations', 'root_component', 'root_component_config',
    'root_component_definition', 'schema_version', 'state_properties',
    'sys_class_name', 'sys_created_by', 'sys_created_on', 'sys_id',
    'sys_mod_count', 'sys_name', 'sys_package', 'sys_policy', 'sys_scope',
    'sys_update_name', 'sys_updated_by', 'sys_updated_on'
];

const KNOWN_TAGS = [
    ...REQUIRED_TAGS,
    'disable_auto_reflow', 'form_factors', 'keyboard_shortcuts',
    'required_sys_props', 'state_persistence_config', 'style_config'
];

const JSON_FIELDS = [
    'bundles', 'composition', 'data', 'da_relay_models', 'form_factors',
    'internal_event_mappings', 'layout', 'props', 'required_translations',
    'root_component_config', 'state_properties'
];

export class MacroponentValidator {
    private text: string;
    private lines: string[];
    private lineOffsets: number[];
    private errors: ValidationIssue[] = [];
    private warnings: ValidationIssue[] = [];
    private highlightMap: Map<number, 'error' | 'warning'> = new Map();

    constructor(text: string) {
        this.text = text;
        this.lines = text.split('\n');
        this.lineOffsets = this.computeLineOffsets(text);
    }

    public validate(): ValidationResult {
        this.errors = [];
        this.warnings = [];
        this.highlightMap = new Map();

        const lowerText = this.text.toLowerCase();

        const tagIndex = this.buildTagIndex();
        const jsonContentCache = new Map<string, { jsonText: string; baseLine: number } | null>();
        const parser = new DOMParser({
            errorHandler: {
                warning: () => {},
                error: () => {},
                fatalError: () => {}
            }
        });
        const doc = parser.parseFromString(this.text, 'application/xml');

        const parseError = doc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            const errorText = parseError.textContent || 'XML parsing error';
            const errorLine = this.findXMLErrorLine(errorText);
            
            this.errors.push({
                severity: 'error',
                message: 'XML Parse Error',
                detail: errorText,
                line: errorLine || 1,
                startChar: 0,
                endChar: this.lines[errorLine - 1]?.length || 0
            });
            
            return this.buildResult();
        }

        const root = doc.documentElement;
        if (!root || root.tagName !== 'record_update') {
            this.errors.push({
                severity: 'error',
                message: 'Expected <record_update> as document root',
                line: 1,
                startChar: 0,
                endChar: this.lines[0]?.length || 0
            });
            return this.buildResult();
        }

        const sysNode = this.getChildByTagName(root, 'sys_ux_macroponent');
        if (!sysNode) {
            this.errors.push({
                severity: 'error',
                message: 'Missing <sys_ux_macroponent> element',
                line: 1,
                startChar: 0,
                endChar: this.lines[0]?.length || 0
            });
            return this.buildResult();
        }

        const tableAttr = root.getAttribute('table');
        if (tableAttr !== 'sys_ux_macroponent') {
            const line = this.findAttributeLine('table', tableAttr || '');
            this.errors.push({
                severity: 'error',
                message: 'record_update@table must be \'sys_ux_macroponent\'',
                detail: `Found '${tableAttr || ''}' instead`,
                line: line,
                startChar: 0,
                endChar: this.lines[line - 1]?.length || 0
            });
            return this.buildResult();
        }

        const childTags = this.getChildElementTagNames(sysNode);
        const tagCounts = this.countTags(childTags);
        const childSet = new Set(childTags);

        REQUIRED_TAGS.forEach(tag => {
            if (!childSet.has(tag)) {
                const line = tagIndex[tag]?.[0] || 1;
                this.errors.push({
                    severity: 'error',
                    message: `Missing required element <${tag}>`,
                    line: line,
                    startChar: 0,
                    endChar: this.lines[line - 1]?.length || 0
                });
            }
        });

        Object.entries(tagCounts)
            .filter(([, count]) => count > 1)
            .forEach(([tag, count]) => {
                const line = tagIndex[tag]?.[1] || tagIndex[tag]?.[0] || 1;
                this.errors.push({
                    severity: 'error',
                    message: `Element <${tag}> appears ${count} times but must be unique`,
                    line: line,
                    startChar: 0,
                    endChar: this.lines[line - 1]?.length || 0
                });
            });

        const unknown = Array.from(childSet).filter(tag => !KNOWN_TAGS.includes(tag));
        unknown.forEach(tag => {
            const line = tagIndex[tag]?.[0] || 1;
            this.warnings.push({
                severity: 'warning',
                message: `Encountered new element <${tag}> (not in reference schema)`,
                line: line,
                startChar: 0,
                endChar: this.lines[line - 1]?.length || 0
            });
        });

        const jsonTags = KNOWN_TAGS.filter(tag => JSON_FIELDS.includes(tag));
        
        jsonTags.forEach((tag) => {
            const el = this.getChildByTagName(sysNode, tag);
            if (!el) return;

            let info = jsonContentCache.get(tag);
            if (info === undefined) {
                const located = this.locateJsonContent(lowerText, tag);
                jsonContentCache.set(tag, located);
                info = located;
            }

            const jsonCandidate = info?.jsonText ?? this.getTextContent(el).trim();
            if (!jsonCandidate || jsonCandidate.startsWith('javascript(')) return;

            let dupKeys: Array<{ key: string; position: number }> = [];
            try {
                dupKeys = this.scanDuplicateKeysTolerant(jsonCandidate);
            } catch (error) {
                // Silently skip if duplicate scanning fails
            }
            for (const dup of dupKeys) {
                const derivedLine = this.calculateJsonErrorLine(
                    `Duplicate key '${dup.key}' at position ${dup.position}`,
                    info?.jsonText ?? jsonCandidate,
                    info?.baseLine ?? 0
                );
                const line = derivedLine || tagIndex[tag]?.[0] || 1;
                const { startChar, endChar } = this.getErrorRange(line, jsonCandidate, dup.position);
                
                this.errors.push({
                    severity: 'error',
                    message: 'Invalid JSON: Duplicate Key',
                    detail: `The key "${dup.key}" appears multiple times in the same object. Each key must be unique.`,
                    line: line,
                    startChar: startChar,
                    endChar: endChar,
                    suggestedFix: `Remove or rename the duplicate "${dup.key}" key. Keep only one instance with the correct value.`
                });
            }

            let syntaxIssues: Array<{ message: string; position: number }> = [];
            try {
                syntaxIssues = this.lintJsonSyntax(jsonCandidate);
            } catch (error) {
                // Add a generic error if linting completely fails
                syntaxIssues = [{ message: 'Failed to parse JSON - severely malformed', position: 0 }];
            }
            for (const issue of syntaxIssues) {
                const derivedLine = this.calculateJsonErrorLine(
                    `${issue.message} at position ${issue.position}`,
                    info?.jsonText ?? jsonCandidate,
                    info?.baseLine ?? 0
                );
                const line = derivedLine || tagIndex[tag]?.[0] || 1;
                const { startChar, endChar } = this.getErrorRange(line, jsonCandidate, issue.position);
                
                const suggestedFix = this.getSuggestedFix(issue.message);
                const entry: ValidationIssue = {
                    severity: issue.message.startsWith('Trailing comma') ? 'warning' : 'error',
                    message: issue.message.startsWith('Trailing comma') ? 'Potentially permissive JSON' : 'Invalid JSON',
                    detail: issue.message,
                    line: line,
                    startChar: startChar,
                    endChar: endChar,
                    suggestedFix: suggestedFix
                };
                
                if (entry.severity === 'warning') {
                    this.warnings.push(entry);
                } else {
                    this.errors.push(entry);
                }
            }
        });

        [...this.errors, ...this.warnings].forEach(issue => {
            const existing = this.highlightMap.get(issue.line);
            if (existing === 'error') return;
            if (issue.severity === 'error' || !existing) {
                this.highlightMap.set(issue.line, issue.severity);
            }
        });

        return this.buildResult();
    }

    private buildResult(): ValidationResult {
        return {
            errors: this.errors,
            warnings: this.warnings,
            highlightMap: this.highlightMap
        };
    }

    private computeLineOffsets(text: string): number[] {
        const offsets = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                offsets.push(i + 1);
            }
        }
        return offsets;
    }

    private findLineFromIndex(index: number): number {
        if (index <= 0) return 1;
        let low = 0;
        let high = this.lineOffsets.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.lineOffsets[mid] <= index) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        const line = high + 1;
        return line > 0 ? line : 1;
    }

    private buildTagIndex(): Record<string, number[]> {
        const index: Record<string, number[]> = {};
        const tagPattern = /<\s*([a-zA-Z_][\w.-]*)/g;
        
        this.lines.forEach((line, idx) => {
            if (line.includes('<?') || line.trim().startsWith('<!--')) return;
            
            let match;
            tagPattern.lastIndex = 0;
            while ((match = tagPattern.exec(line)) !== null) {
                const literal = match[0];
                if (literal.startsWith('</')) continue;
                
                const tag = match[1].toLowerCase();
                if (!index[tag]) {
                    index[tag] = [];
                }
                const lineNum = idx + 1;
                if (index[tag][index[tag].length - 1] !== lineNum) {
                    index[tag].push(lineNum);
                }
            }
        });
        
        return index;
    }

    private locateJsonContent(lowerText: string, tag: string): { jsonText: string; baseLine: number } | null {
        const openPattern = new RegExp(`<\\s*${tag}\\b`, 'g');
        const openMatch = openPattern.exec(lowerText);
        if (!openMatch) return null;

        const openIndex = openMatch.index;
        const openTagEnd = this.text.indexOf('>', openIndex);
        if (openTagEnd === -1) return null;

        let searchIndex = openTagEnd;
        let closeIndex = -1;
        
        while (searchIndex < this.text.length) {
            const candidate = lowerText.indexOf(`</${tag}`, searchIndex);
            if (candidate === -1) break;
            
            const prevChar = this.text[candidate - 1];
            if (prevChar === '"' || prevChar === "'") {
                searchIndex = candidate + tag.length + 3;
                continue;
            }
            
            const closeTagEnd = this.text.indexOf('>', candidate);
            if (closeTagEnd === -1) break;
            
            closeIndex = candidate;
            break;
        }

        if (closeIndex === -1) return null;

        const contentStart = openTagEnd + 1;
        const contentEnd = closeIndex;
        if (contentEnd <= contentStart) {
            return { jsonText: '', baseLine: this.findLineFromIndex(contentStart) };
        }

        const rawContent = this.text.slice(contentStart, contentEnd);
        const trimmed = rawContent.trim();
        if (!trimmed) {
            return { jsonText: '', baseLine: this.findLineFromIndex(contentStart) };
        }

        const leadingOffset = rawContent.indexOf(trimmed);
        const trimmedStartIndex = contentStart + (leadingOffset >= 0 ? leadingOffset : 0);
        const baseLine = this.findLineFromIndex(trimmedStartIndex);
        
        return { jsonText: trimmed, baseLine };
    }

    private calculateJsonErrorLine(detail: string, jsonText: string, baseLine: number): number | null {
        if (!baseLine || !jsonText) return null;

        let relativeLine: number | null = null;
        const lineMatch = detail.match(/line\s+(\d+)/i);
        if (lineMatch) {
            relativeLine = Number(lineMatch[1]);
        }

        if (!relativeLine || isNaN(relativeLine) || relativeLine <= 0) {
            const positionMatch = detail.match(/position\s+(\d+)/i);
            if (positionMatch) {
                const position = Number(positionMatch[1]);
                if (!isNaN(position)) {
                    const clamped = Math.max(0, Math.min(position, jsonText.length));
                    let newlineCount = 0;
                    for (let i = 0; i < clamped; i++) {
                        if (jsonText.charCodeAt(i) === 10) {
                            newlineCount++;
                        }
                    }
                    relativeLine = newlineCount + 1;
                }
            }
        }

        if (!relativeLine || isNaN(relativeLine)) return null;
        return baseLine + relativeLine - 1;
    }

    private lintJsonSyntax(jsonString: string): Array<{ message: string; position: number }> {
        const issues: Array<{ message: string; position: number }> = [];
        const len = jsonString.length;
        const stack: string[] = [];
        let inString = false;
        let escape = false;
        let lastSig: string | null = null;

        for (let i = 0; i < len; i++) {
            const ch = jsonString[i];
            
            if (inString) {
                if (escape) {
                    escape = false;
                    continue;
                }
                if (ch === '\\') {
                    escape = true;
                    continue;
                }
                if (ch === '"') {
                    inString = false;
                    lastSig = 'value';
                }
                continue;
            }

            if (/\s/.test(ch)) continue;

            if (ch === '"') {
                inString = true;
                if (lastSig === 'value' || lastSig === '}' || lastSig === ']') {
                    issues.push({ message: 'Missing comma between items', position: i });
                }
                lastSig = '"';
                continue;
            }

            if (ch === '{') {
                if (lastSig === 'value' || lastSig === '}' || lastSig === ']') {
                    issues.push({ message: 'Missing comma between items', position: i });
                }
                stack.push('object');
                lastSig = 'object';
                continue;
            }
            
            if (ch === '[') {
                if (lastSig === 'value' || lastSig === '}' || lastSig === ']') {
                    issues.push({ message: 'Missing comma between items', position: i });
                }
                stack.push('array');
                lastSig = 'array';
                continue;
            }
            
            if (ch === '}') {
                if (lastSig === ',') {
                    issues.push({ message: 'Trailing comma before }', position: i - 1 >= 0 ? i - 1 : i });
                }
                if (!stack.length || stack[stack.length - 1] !== 'object') {
                    issues.push({ message: 'Unexpected }', position: i });
                } else {
                    stack.pop();
                }
                lastSig = '}';
                continue;
            }
            
            if (ch === ']') {
                if (lastSig === ',') {
                    issues.push({ message: 'Trailing comma before ]', position: i - 1 >= 0 ? i - 1 : i });
                }
                if (!stack.length || stack[stack.length - 1] !== 'array') {
                    issues.push({ message: 'Unexpected ]', position: i });
                } else {
                    stack.pop();
                }
                lastSig = ']';
                continue;
            }
            
            if (ch === ',') {
                if (lastSig === '{' || lastSig === '[' || lastSig === ',' || lastSig === ':') {
                    issues.push({ message: 'Unexpected ,', position: i });
                }
                lastSig = ',';
                continue;
            }
            
            if (ch === ':') {
                if (stack.length === 0 || stack[stack.length - 1] !== 'object') {
                    issues.push({ message: 'Key-value syntax only allowed inside objects', position: i });
                }
                lastSig = ':';
                continue;
            }

            if (/[0-9\-tfn]/.test(ch)) {
                if (lastSig === 'value' || lastSig === '}' || lastSig === ']') {
                    issues.push({ message: 'Missing comma between items', position: i });
                }
                let j = i + 1;
                while (j < len && !/[\s,\]\}]/.test(jsonString[j])) j++;
                i = j - 1;
                lastSig = 'value';
                continue;
            }

            issues.push({ message: `Unexpected character ${ch}`, position: i });
            lastSig = ch;
        }

        if (inString) {
            issues.push({ message: 'Unterminated string', position: len });
        }
        
        if (stack.length) {
            const open = stack[stack.length - 1];
            issues.push({ message: `Unclosed ${open === 'object' ? 'object' : 'array'}`, position: len });
        }
        
        return issues;
    }

    private scanDuplicateKeysTolerant(jsonString: string): Array<{ key: string; position: number }> {
        const dups: Array<{ key: string; position: number }> = [];
        const len = jsonString.length;
        const stack: Array<{ type: string; keys: Set<string> }> = [];
        let i = 0;
        
        // Performance optimization: limit iterations for very large JSON
        const MAX_ITERATIONS = 1000000;
        let iterations = 0;

        const skipWhitespace = () => {
            while (i < len && /\s/.test(jsonString[i])) {
                i++;
                if (++iterations > MAX_ITERATIONS) throw new Error('Max iterations exceeded');
            }
        };

        const readString = (): string => {
            i++;
            const start = i;
            let escape = false;
            while (i < len) {
                if (++iterations > MAX_ITERATIONS) throw new Error('Max iterations exceeded');
                const ch = jsonString[i];
                if (escape) {
                    escape = false;
                    i++;
                    continue;
                }
                if (ch === '\\') {
                    escape = true;
                    i++;
                    continue;
                }
                if (ch === '"') {
                    const s = jsonString.slice(start, i);
                    i++;
                    return s;
                }
                i++;
            }
            return jsonString.slice(start, i);
        };

        const parseValue: () => void = () => {
            skipWhitespace();
            if (i >= len) return;
            
            const ch = jsonString[i];
            if (ch === '"') {
                readString();
                return;
            }
            if (ch === '{') {
                parseObject();
                return;
            }
            if (ch === '[') {
                parseArray();
                return;
            }
            while (i < len && !/[\s,\]\}]/.test(jsonString[i])) i++;
        };

        const parseObject = () => {
            if (jsonString[i] !== '{') return;
            i++;
            stack.push({ type: 'object', keys: new Set<string>() });
            
            skipWhitespace();
            if (i < len && jsonString[i] === '}') {
                stack.pop();
                i++;
                return;
            }

            while (i < len) {
                if (++iterations > MAX_ITERATIONS) throw new Error('Max iterations exceeded');
                skipWhitespace();
                if (i >= len) break;
                
                if (jsonString[i] === '}') {
                    stack.pop();
                    i++;
                    break;
                }

                if (jsonString[i] === '"') {
                    const keyStart = i;
                    const key = readString();
                    skipWhitespace();
                    
                    if (i < len && jsonString[i] === ':') {
                        i++;
                        const top = stack[stack.length - 1];
                        if (top && top.keys.has(key)) {
                            dups.push({ key, position: keyStart });
                        }
                        if (top) {
                            top.keys.add(key);
                        }
                        parseValue();
                        skipWhitespace();
                        if (i < len && jsonString[i] === ',') {
                            i++;
                        }
                    }
                } else if (jsonString[i] === ',') {
                    i++;
                } else {
                    i++;
                }
            }
        };

        const parseArray = () => {
            if (jsonString[i] !== '[') return;
            i++;
            stack.push({ type: 'array', keys: new Set<string>() });
            
            skipWhitespace();
            if (i < len && jsonString[i] === ']') {
                stack.pop();
                i++;
                return;
            }

            while (i < len) {
                if (++iterations > MAX_ITERATIONS) throw new Error('Max iterations exceeded');
                skipWhitespace();
                if (i >= len) break;
                
                if (jsonString[i] === ']') {
                    stack.pop();
                    i++;
                    break;
                }

                parseValue();
                skipWhitespace();
                if (i < len && jsonString[i] === ',') {
                    i++;
                }
            }
        };

        skipWhitespace();
        if (i < len) {
            const ch = jsonString[i];
            if (ch === '{') {
                parseObject();
            } else if (ch === '[') {
                parseArray();
            }
        }

        return dups;
    }

    private getChildByTagName(element: any, tagName: string): any {
        if (!element || !element.childNodes) return null;
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === 1 && child.tagName === tagName) {
                return child;
            }
        }
        return null;
    }

    private findChildByTagName(element: any, tagName: string): any {
        if (!element || !element.childNodes) return null;
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === 1 && child.tagName.toLowerCase() === tagName.toLowerCase()) {
                return child;
            }
        }
        return null;
    }

    private getChildElementTagNames(element: any): string[] {
        const tags: string[] = [];
        if (!element || !element.childNodes) return tags;
        
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === 1) {
                tags.push(child.tagName.toLowerCase());
            }
        }
        return tags;
    }

    private countTags(tags: string[]): Record<string, number> {
        return tags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    private getTextContent(element: any): string {
        if (!element) return '';
        if (element.textContent !== undefined) return element.textContent;
        
        let text = '';
        if (element.childNodes) {
            for (let i = 0; i < element.childNodes.length; i++) {
                const child = element.childNodes[i];
                if (child.nodeType === 3 || child.nodeType === 4) {
                    text += child.nodeValue || '';
                }
            }
        }
        return text;
    }

    private findXMLErrorLine(errorText: string): number {
        const lineMatch = errorText.match(/line\s+(\d+)/i);
        if (lineMatch) {
            return parseInt(lineMatch[1], 10);
        }
        return 1;
    }

    private findAttributeLine(attrName: string, attrValue: string): number {
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lines[i].includes(attrName) && this.lines[i].includes(attrValue)) {
                return i + 1;
            }
        }
        return 1;
    }

    private getErrorRange(line: number, jsonText: string, position: number): { startChar: number; endChar: number } {
        const lineText = this.lines[line - 1] || '';
        const lineLength = lineText.length;
        
        const contextLength = 50;
        const start = Math.max(0, position - contextLength);
        const end = Math.min(lineLength, position + contextLength);
        
        return {
            startChar: start,
            endChar: end > start ? end : lineLength
        };
    }

    private getSuggestedFix(errorMessage: string): string {
        if (errorMessage.includes('Missing comma between items')) {
            return 'Add a comma (,) between the items. Example: {"key1": "value1", "key2": "value2"}';
        }
        if (errorMessage.includes('Trailing comma')) {
            return 'Remove the trailing comma before the closing bracket/brace.';
        }
        if (errorMessage.includes('Unexpected }')) {
            return 'Check for missing opening brace ({) or remove the extra closing brace (}).';
        }
        if (errorMessage.includes('Unexpected ]')) {
            return 'Check for missing opening bracket ([) or remove the extra closing bracket (]).';
        }
        if (errorMessage.includes('Unexpected ,')) {
            return 'Remove the extra comma or add a value before it.';
        }
        if (errorMessage.includes('Unterminated string')) {
            return 'Add a closing double quote (") to complete the string.';
        }
        if (errorMessage.includes('Unclosed object')) {
            return 'Add a closing brace (}) to complete the object.';
        }
        if (errorMessage.includes('Unclosed array')) {
            return 'Add a closing bracket (]) to complete the array.';
        }
        if (errorMessage.includes('Unexpected character')) {
            return 'Remove or escape the unexpected character. Check for invalid JSON syntax.';
        }
        if (errorMessage.includes('Key-value syntax only allowed inside objects')) {
            return 'Move the key-value pair inside an object { ... } or remove the colon.';
        }
        return 'Review the JSON syntax. Ensure proper use of commas, brackets, braces, and quotes.';
    }
}
