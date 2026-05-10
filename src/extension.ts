import * as vscode from 'vscode';
import { MacroponentValidator } from './validator';
import { DiagnosticsManager } from './diagnosticsManager';
import { ErrorNavigator } from './errorNavigator';
import { DecorationManager } from './decorationManager';

let diagnosticsManager: DiagnosticsManager;
let errorNavigator: ErrorNavigator;
let decorationManager: DecorationManager;
let validationTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Macroponent Validator extension is now active');

    diagnosticsManager = new DiagnosticsManager();
    errorNavigator = new ErrorNavigator();
    decorationManager = new DecorationManager();

    const validateCommand = vscode.commands.registerCommand(
        'macroponent-validator.validate',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && isMacroponentFile(editor.document)) {
                validateDocument(editor.document);
            } else {
                vscode.window.showWarningMessage(
                    'This command only works on macroponent XML files (filename starts with sys_ux_macroponent)'
                );
            }
        }
    );

    const nextErrorCommand = vscode.commands.registerCommand(
        'macroponent-validator.nextError',
        () => {
            errorNavigator.nextError();
        }
    );

    const previousErrorCommand = vscode.commands.registerCommand(
        'macroponent-validator.previousError',
        () => {
            errorNavigator.previousError();
        }
    );

    const onSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('macroponentValidator');
        const validateOnSave = config.get<boolean>('validateOnSave', true);

        if (validateOnSave && isMacroponentFile(document)) {
            validateDocument(document);
        }
    });

    const onOpenListener = vscode.workspace.onDidOpenTextDocument((document) => {
        if (isMacroponentFile(document)) {
            validateDocument(document);
        }
    });

    const onChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (isMacroponentFile(event.document)) {
            if (validationTimeout) {
                clearTimeout(validationTimeout);
            }
            validationTimeout = setTimeout(() => {
                validateDocument(event.document);
            }, 1000);
        }
    });

    const onCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
        if (isMacroponentFile(document)) {
            diagnosticsManager.clearDiagnostics(document);
            errorNavigator.clear();
        }
    });

    const onEditorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isMacroponentFile(editor.document)) {
            const issues = diagnosticsManager.getIssues(editor.document);
            decorationManager.updateDecorations(editor, issues);
            errorNavigator.updateErrors(editor.document, issues);
        } else {
            errorNavigator.clear();
        }
    });

    context.subscriptions.push(
        validateCommand,
        nextErrorCommand,
        previousErrorCommand,
        onSaveListener,
        onOpenListener,
        onChangeListener,
        onCloseListener,
        onEditorChangeListener,
        diagnosticsManager,
        errorNavigator,
        decorationManager
    );

    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (isMacroponentFile(document)) {
            validateDocument(document);
        }
    }
}

function isMacroponentFile(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.toLowerCase();
    return fileName.endsWith('.xml') && fileName.includes('sys_ux_macroponent');
}

async function validateDocument(document: vscode.TextDocument): Promise<void> {
    return new Promise((resolve) => {
        setImmediate(async () => {
            try {
                const text = document.getText();
                
                const validator = new MacroponentValidator(text);
                const result = await Promise.resolve(validator.validate());

                const allIssues = [...result.errors, ...result.warnings];
                diagnosticsManager.setDiagnostics(document, allIssues);

                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === document) {
                    decorationManager.updateDecorations(editor, allIssues);
                    errorNavigator.updateErrors(document, allIssues);
                }

                const errorCount = result.errors.length;
                const warningCount = result.warnings.length;
                
                if (errorCount === 0 && warningCount === 0) {
                    vscode.window.setStatusBarMessage(
                        '$(check) Macroponent validation passed',
                        3000
                    );
                } else {
                    const message = `$(error) ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
                    vscode.window.setStatusBarMessage(message, 5000);
                }

                resolve();
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Macroponent validation failed: ${error instanceof Error ? error.message : String(error)}`
                );
                resolve();
            }
        });
    });
}

export function deactivate() {
    if (validationTimeout) {
        clearTimeout(validationTimeout);
    }
}
