import * as vscode from 'vscode';
import { ValidationIssue } from './validator';

export class DecorationManager {
    private errorDecorationType: vscode.TextEditorDecorationType;
    private warningDecorationType: vscode.TextEditorDecorationType;

    constructor() {
        this.errorDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            isWholeLine: false,
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });

        this.warningDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 165, 0, 0.15)',
            border: '1px solid rgba(255, 165, 0, 0.4)',
            isWholeLine: false,
            overviewRulerColor: 'orange',
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    public updateDecorations(editor: vscode.TextEditor, issues: ValidationIssue[]): void {
        const errorRanges: vscode.DecorationOptions[] = [];
        const warningRanges: vscode.DecorationOptions[] = [];

        for (const issue of issues) {
            const line = Math.max(0, issue.line - 1);
            const startChar = Math.max(0, issue.startChar);
            const endChar = issue.endChar;

            const lineText = editor.document.lineAt(line).text;
            const range = new vscode.Range(
                line,
                Math.min(startChar, lineText.length),
                line,
                Math.min(endChar, lineText.length)
            );

            let hoverText = `**${issue.severity.toUpperCase()}**: ${issue.message}\n\n${issue.detail || ''}`;
            if (issue.suggestedFix) {
                hoverText += `\n\n---\n\n💡 **Suggested Fix**:\n${issue.suggestedFix}`;
            }
            
            const decoration: vscode.DecorationOptions = {
                range,
                hoverMessage: new vscode.MarkdownString(hoverText)
            };

            if (issue.severity === 'error') {
                errorRanges.push(decoration);
            } else {
                warningRanges.push(decoration);
            }
        }

        editor.setDecorations(this.errorDecorationType, errorRanges);
        editor.setDecorations(this.warningDecorationType, warningRanges);
    }

    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.errorDecorationType, []);
        editor.setDecorations(this.warningDecorationType, []);
    }

    public dispose(): void {
        this.errorDecorationType.dispose();
        this.warningDecorationType.dispose();
    }
}
