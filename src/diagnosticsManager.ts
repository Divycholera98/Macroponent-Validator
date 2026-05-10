import * as vscode from 'vscode';
import { ValidationIssue } from './validator';

export class DiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private errorsByDocument: Map<string, ValidationIssue[]> = new Map();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('macroponent');
    }

    public setDiagnostics(document: vscode.TextDocument, issues: ValidationIssue[]): void {
        const diagnostics: vscode.Diagnostic[] = [];
        
        for (const issue of issues) {
            const line = Math.max(0, issue.line - 1);
            const startChar = Math.max(0, issue.startChar);
            const endChar = issue.endChar;
            
            const lineText = document.lineAt(line).text;
            const range = new vscode.Range(
                line,
                Math.min(startChar, lineText.length),
                line,
                Math.min(endChar, lineText.length)
            );

            let message = `${issue.message}${issue.detail ? ': ' + issue.detail : ''}`;
            if (issue.suggestedFix) {
                message += `\n\n💡 Suggested Fix: ${issue.suggestedFix}`;
            }
            
            const diagnostic = new vscode.Diagnostic(
                range,
                message,
                issue.severity === 'error' 
                    ? vscode.DiagnosticSeverity.Error 
                    : vscode.DiagnosticSeverity.Warning
            );
            
            diagnostic.source = 'Macroponent Validator';
            diagnostics.push(diagnostic);
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
        this.errorsByDocument.set(document.uri.toString(), issues);
    }

    public clearDiagnostics(document: vscode.TextDocument): void {
        this.diagnosticCollection.delete(document.uri);
        this.errorsByDocument.delete(document.uri.toString());
    }

    public getIssues(document: vscode.TextDocument): ValidationIssue[] {
        return this.errorsByDocument.get(document.uri.toString()) || [];
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.errorsByDocument.clear();
    }
}
