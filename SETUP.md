# Macroponent Validator - Setup Instructions

## Quick Start Guide

Follow these steps to get the extension running:

### 1. Install Dependencies

Open a terminal in the extension directory and run:

```bash
npm install
```

This installs:
- TypeScript compiler
- VS Code extension API types
- XML DOM parser
- ESLint and development tools

### 2. Compile the Extension

```bash
npm run compile
```

This compiles TypeScript files from `src/` to JavaScript in `out/`.

### 3. Run in Development Mode

**Option A: Using VS Code**
1. Open this folder in VS Code
2. Press `F5` or go to Run → Start Debugging
3. A new "Extension Development Host" window opens
4. Open any macroponent XML file (filename starts with `sys_ux_macroponent`)

**Option B: Using Command Line**
```bash
code --extensionDevelopmentPath=/Users/divy.cholera/localhost/repos/vs\ parser
```

### 4. Test the Extension

In the Extension Development Host window:

1. **Open a macroponent file**:
   - Navigate to `/Users/divy.cholera/localhost/repos/sn-squadra-ws/app-squadra-workspace/src/main/plugins/com.snc.cwm/update/`
   - Open any file starting with `sys_ux_macroponent_`

2. **Trigger validation**:
   - Save the file (`Cmd+S`)
   - Right-click → "Validate Macroponent"
   - Or use Command Palette (`Cmd+Shift+P`) → "Validate Macroponent"

3. **Verify features**:
   - Check for error underlines in the editor
   - Look at the Problems panel (View → Problems)
   - Click the error counter in status bar (bottom right)
   - Hover over errors to see detailed messages

## Development Workflow

### Auto-recompile on Changes

```bash
npm run watch
```

Leave this running while developing. It automatically recompiles TypeScript when you save changes.

After making changes:
1. Save your file
2. In the Extension Development Host window, press `Cmd+R` to reload

### Testing Changes

Create a test file with intentional errors:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<record_update table="sys_ux_macroponent">
  <sys_ux_macroponent>
    <composition>[
      {
        "test": "value"
        "missing": "comma"
      }
    ]</composition>
  </sys_ux_macroponent>
</record_update>
```

Expected behavior:
- Error highlighting on the line with missing comma
- Diagnostic in Problems panel
- Error navigation available in status bar

## Building for Distribution

### Create VSIX Package

```bash
# Install vsce globally (one-time)
npm install -g @vscode/vsce

# Build the package
npm run package
```

This creates `macroponent-validator-1.0.0.vsix`.

### Install VSIX Locally

```bash
code --install-extension macroponent-validator-1.0.0.vsix
```

Or in VS Code:
1. Extensions view (`Cmd+Shift+X`)
2. Click `...` menu → "Install from VSIX..."
3. Select the `.vsix` file

### Publish to Marketplace

1. Create a publisher account at https://marketplace.visualstudio.com/
2. Update `publisher` field in `package.json`
3. Generate a Personal Access Token (PAT)
4. Publish:

```bash
vsce login your-publisher-name
vsce publish
```

## Configuration

### Extension Settings

The extension contributes these settings to VS Code:

```json
{
  "macroponentValidator.validateOnSave": true,
  "macroponentValidator.showNavigationUI": true
}
```

Users can modify these in:
- Settings UI: `Cmd+,` → search "macroponent"
- `settings.json`: Add the JSON above

### Activation Events

The extension activates when:
- Opening XML files
- Running validation commands
- Triggered automatically by VS Code based on commands/menus

## Architecture Overview

### File Structure

```
vs parser/
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
├── .vscodeignore           # Files excluded from package
├── README.md               # User documentation
├── SETUP.md               # This file
├── src/
│   ├── extension.ts        # Main entry point
│   ├── validator.ts        # Core validation logic
│   ├── diagnosticsManager.ts  # VS Code diagnostics
│   ├── errorNavigator.ts   # Error navigation UI
│   └── decorationManager.ts   # Visual highlights
└── out/                    # Compiled JavaScript (generated)
```

### Extension Lifecycle

1. **Activation**: When XML file is opened or command is run
2. **Registration**: Commands, menus, and event listeners are registered
3. **File Detection**: Checks if filename matches `sys_ux_macroponent*.xml`
4. **Validation**: Parses XML and embedded JSON, collects all errors
5. **Display**: Shows diagnostics, decorations, and navigation UI
6. **Deactivation**: Cleanup on VS Code exit

### Key Components

**Validator** (`validator.ts`)
- Parses XML using `xmldom`
- Extracts JSON from specific tags
- Validates JSON syntax tolerantly (finds all errors)
- Detects duplicate keys, missing commas, bracket mismatches
- Returns structured error list with line/character positions

**DiagnosticsManager** (`diagnosticsManager.ts`)
- Converts validation issues to VS Code diagnostics
- Populates Problems panel
- Manages diagnostic lifecycle per document

**DecorationManager** (`decorationManager.ts`)
- Creates visual error highlights in editor
- Red for errors, orange for warnings
- Adds hover tooltips with error details

**ErrorNavigator** (`errorNavigator.ts`)
- Status bar item showing error count
- Next/Previous error commands
- Automatically scrolls to error location

## Troubleshooting

### TypeScript Errors

If you see compilation errors:

```bash
# Clean and rebuild
rm -rf out/
npm run compile
```

### Missing Types

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Extension Not Loading

1. Check the Output panel (View → Output → "Extension Host")
2. Look for error messages
3. Verify `package.json` has correct `main` field: `"./out/extension.js"`
4. Ensure `out/extension.js` exists after compilation

### Validation Not Working

1. Confirm filename starts with `sys_ux_macroponent` and ends with `.xml`
2. Check Developer Console (Help → Toggle Developer Tools)
3. Look for JavaScript errors in console
4. Verify XML is well-formed enough to parse

## Next Steps

### Enhancements to Consider

- **Auto-fix**: Suggest fixes for common errors (missing commas, etc.)
- **Schema validation**: Validate against ServiceNow macroponent schema
- **Diff view**: Show before/after for merge conflicts
- **Bulk validation**: Validate all macroponents in workspace
- **Custom rules**: Configurable validation rules
- **Performance profiling**: Optimize for very large files (>10MB)

### Contributing

When adding new features:
1. Add to appropriate module (validator, diagnostics, etc.)
2. Update tests if applicable
3. Document in README.md
4. Bump version in package.json
5. Update CHANGELOG.md

## Support

For issues or questions:
1. Check README.md troubleshooting section
2. Review VS Code extension development docs: https://code.visualstudio.com/api
3. Check xmldom documentation: https://github.com/xmldom/xmldom

## Reference Files

Test with real macroponent files from:
```
/Users/divy.cholera/localhost/repos/sn-squadra-ws/app-squadra-workspace/src/main/plugins/com.snc.cwm/update/sys_ux_macroponent_*.xml
```

These files contain complex nested JSON structures that exercise all validation features.
