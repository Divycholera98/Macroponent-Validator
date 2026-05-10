import * as vscode from 'vscode';
import { ValidationIssue } from './validator';

export class ErrorNavigator {
    private statusBarItem: vscode.StatusBarItem;
    private currentErrorIndex: number = -1;
    private errors: ValidationIssue[] = [];
    private activeDocument: vscode.TextDocument | undefined;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this.statusBarItem.tooltip = 'Macroponent Validation Errors';
    }

    public updateErrors(document: vscode.TextDocument, errors: ValidationIssue[]): void {
        this.activeDocument = document;
        this.errors = errors.filter(e => e.severity === 'error');
        this.currentErrorIndex = -1;
        this.updateStatusBar();
    }

    public nextError(): void {
        if (this.errors.length === 0 || !this.activeDocument) {
            vscode.window.showInformationMessage('No validation errors found');
            return;
        }

        this.currentErrorIndex = (this.currentErrorIndex + 1) % this.errors.length;
        this.navigateToError();
    }

    public previousError(): void {
        if (this.errors.length === 0 || !this.activeDocument) {
            vscode.window.showInformationMessage('No validation errors found');
            return;
        }

        this.currentErrorIndex = this.currentErrorIndex <= 0 
            ? this.errors.length - 1 
            : this.currentErrorIndex - 1;
        this.navigateToError();
    }

    private navigateToError(): void {
        if (!this.activeDocument || this.currentErrorIndex < 0 || this.currentErrorIndex >= this.errors.length) {
            return;
        }

        const error = this.errors[this.currentErrorIndex];
        const line = Math.max(0, error.line - 1);
        const startChar = Math.max(0, error.startChar);
        
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== this.activeDocument) {
            return;
        }

        const range = new vscode.Range(line, startChar, line, error.endChar);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        this.updateStatusBar();
        
        vscode.window.showInformationMessage(
            `Error ${this.currentErrorIndex + 1}/${this.errors.length}: ${error.message}`
        );
    }

    private updateStatusBar(): void {
        if (this.errors.length === 0) {
            this.statusBarItem.text = '$(check) No Errors';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.command = undefined;
        } else {
            const current = this.currentErrorIndex >= 0 ? this.currentErrorIndex + 1 : 0;
            this.statusBarItem.text = `$(error) ${current}/${this.errors.length}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.command = 'macroponent-validator.nextError';
        }
        this.statusBarItem.show();
    }

    public clear(): void {
        this.errors = [];
        this.currentErrorIndex = -1;
        this.activeDocument = undefined;
        this.statusBarItem.hide();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
