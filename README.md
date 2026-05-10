# Macroponent Validator Extension for VS Code

A production-ready VS Code extension for validating XML macroponent files with embedded JSON structures. This extension helps detect syntax errors, structural issues, and merge conflicts in ServiceNow macroponent files.

## Features

- **Automatic Validation**: Validates macroponent files on save and file open
- **Real-time Error Detection**: Detects all validation errors in a single pass
- **Comprehensive JSON Validation**: 
  - Malformed JSON syntax
  - Broken arrays and objects
  - Missing commas
  - Mismatched brackets/braces
  - Invalid quotes
  - Duplicate object keys
  - Truncated or conflict-corrupted fragments
- **Visual Error Highlighting**: Solid red highlighting for errors with detailed hover information
- **Error Navigation**: Navigate between errors using arrow buttons in the status bar
- **Context Menu Integration**: Right-click "Validate Macroponent" option in editor
- **Performance Optimized**: Handles large files efficiently without blocking the UI

## Installation

### From Source

1. Clone or download this repository
2. Open a terminal in the extension directory
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the extension:
   ```bash
   npm run compile
   ```
5. Press `F5` in VS Code to launch the extension in debug mode

### Building VSIX Package

To create an installable `.vsix` package:

```bash
npm install -g @vscode/vsce
npm run package
```

This creates a `.vsix` file that can be installed via:
- VS Code: Extensions → Install from VSIX
- Command line: `code --install-extension macroponent-validator-1.0.0.vsix`

## Usage

### File Recognition

The extension automatically activates for XML files whose names start with `sys_ux_macroponent`.

### Validation Commands

1. **Manual Validation**: 
   - Right-click in the editor → "Validate Macroponent"
   - Or use Command Palette (`Cmd+Shift+P`) → "Validate Macroponent"

2. **Navigate Errors**:
   - Click the error counter in the status bar (bottom right)
   - Use Command Palette → "Macroponent: Next Error"
   - Use Command Palette → "Macroponent: Previous Error"

3. **Automatic Validation**:
   - Validates automatically on file save (configurable)
   - Updates diagnostics as you type (with 1-second debounce)

### Error Information

Hover over any highlighted error to see:
- Error type (ERROR or WARNING)
- Detailed error message
- Specific issue description (e.g., "Missing comma at position 245")

## Configuration

Access settings via VS Code Settings (`Cmd+,`) and search for "Macroponent":

```json
{
  "macroponentValidator.validateOnSave": true,
  "macroponentValidator.showNavigationUI": true
}
```

### Settings

- `macroponentValidator.validateOnSave` (default: `true`)
  - Automatically validate macroponent files when saved

- `macroponentValidator.showNavigationUI` (default: `true`)
  - Show error navigation controls in the status bar

## Validation Rules

The extension validates:

### XML Structure
- Valid XML syntax
- `<record_update>` root element with `table="sys_ux_macroponent"`
- Required child elements under `<sys_ux_macroponent>`
- No duplicate element tags
- Unknown/new elements (warnings)

### JSON Fields Validated
- `bundles`
- `composition`
- `data`
- `da_relay_models`
- `form_factors`
- `internal_event_mappings`
- `layout`
- `props`
- `required_translations`
- `root_component_config`
- `state_properties`

### JSON Syntax Errors Detected
- Unclosed objects/arrays
- Missing commas between elements
- Trailing commas (warning)
- Unexpected characters
- Mismatched brackets/braces
- Unterminated strings
- Duplicate object keys
- Invalid escape sequences

## Architecture

### Modular Design

```
src/
├── extension.ts          # Extension entry point & command registration
├── validator.ts          # Core validation logic
├── diagnosticsManager.ts # VS Code diagnostics integration
├── errorNavigator.ts     # Error navigation & status bar UI
└── decorationManager.ts  # Visual error highlighting
```

### Performance Features

- **Non-blocking validation**: Uses `setImmediate` to avoid UI freezing
- **Debounced updates**: 1-second delay for typing changes
- **Efficient parsing**: Single-pass validation collects all errors
- **Optimized for large files**: Handles multi-MB macroponent files

### Error Highlighting

- Red background with border for errors
- Orange background for warnings
- Overview ruler markers for quick navigation
- Full line or specific region highlighting

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.75+
- TypeScript 5+

### Build Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Create VSIX package
npm run package
```

### Testing

1. Press `F5` to launch Extension Development Host
2. Open a macroponent XML file from your test directory
3. Trigger validation and verify:
   - Errors are highlighted
   - Diagnostics panel shows issues
   - Navigation works correctly
   - Status bar updates

## Troubleshooting

### Extension Not Activating

- Ensure file name starts with `sys_ux_macroponent` and ends with `.xml`
- Check VS Code console for errors (Help → Toggle Developer Tools)

### No Diagnostics Appearing

- Verify the file has actual validation issues
- Check that validation on save is enabled in settings
- Manually trigger validation via context menu

### Performance Issues

- Large files (>5MB) may take a few seconds to validate
- Validation is debounced by 1 second during typing
- Close unnecessary editors to free resources

## License

MIT

## Author

**Divy Cholera**
- **Portfolio**: [divy-cholera.vercel.app](https://divy-cholera.vercel.app/)
- **GitHub**: [github.com/Divycholera98](https://github.com/Divycholera98)
- **LinkedIn**: [linkedin.com/in/divy-cholera](https://www.linkedin.com/in/divy-cholera-6a6a3820b/)

## Credits

Based on the macroponent parser Chrome extension validation logic, adapted for VS Code with enhanced error detection and navigation features.
