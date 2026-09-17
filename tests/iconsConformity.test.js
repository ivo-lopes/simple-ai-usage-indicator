import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

function getFileContent(filePath) {
    const file = Gio.File.new_for_path(filePath);
    const [ok, bytes] = file.load_contents(null);
    if (!ok)
        throw new Error(`Failed to load file: ${filePath}`);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
}

function extractSvgViewBox(svgContent) {
    const match = svgContent.match(/viewBox=["']([^"']+)["']/);
    return match ? match[1].trim() : null;
}

function extractSvgDimensions(svgContent) {
    const wMatch = svgContent.match(/width=["']([^"']+)["']/);
    const hMatch = svgContent.match(/height=["']([^"']+)["']/);
    return {
        width: wMatch ? wMatch[1].trim() : null,
        height: hMatch ? hMatch[1].trim() : null,
    };
}

async function runTests() {
    const basePath = GLib.get_current_dir();
    const iconsDir = GLib.build_filenamev([basePath, 'icons']);

    const providerIconPrefixes = ['codex', 'claude', 'antigravity'];
    const styles = ['symbolic', 'black', 'color'];

    for (const prefix of providerIconPrefixes) {
        const refSvgName = `${prefix}-symbolic.svg`;
        const refSvgPath = GLib.build_filenamev([iconsDir, refSvgName]);
        const refContent = getFileContent(refSvgPath);
        const refViewBox = extractSvgViewBox(refContent);
        const refDims = extractSvgDimensions(refContent);

        assert(refViewBox !== null, `${refSvgName} must have a viewBox`);

        for (const style of styles) {
            const svgName = `${prefix}-${style}.svg`;
            const svgPath = GLib.build_filenamev([iconsDir, svgName]);
            const content = getFileContent(svgPath);

            const viewBox = extractSvgViewBox(content);
            const dims = extractSvgDimensions(content);

            assert(viewBox === refViewBox,
                `viewBox mismatch in ${svgName}: expected "${refViewBox}", got "${viewBox}" (reference: ${refSvgName})`);

            if (refDims.width) {
                assert(dims.width === refDims.width,
                    `width mismatch in ${svgName}: expected "${refDims.width}", got "${dims.width}" (reference: ${refSvgName})`);
            }
            if (refDims.height) {
                assert(dims.height === refDims.height,
                    `height mismatch in ${svgName}: expected "${refDims.height}", got "${dims.height}" (reference: ${refSvgName})`);
            }
        }
    }

    // Specific conformity checks:
    // Antigravity icons must all have 540x540 viewBox
    const agColorSvg = getFileContent(GLib.build_filenamev([iconsDir, 'antigravity-color.svg']));
    assert(extractSvgViewBox(agColorSvg) === '0 0 540 540',
        'antigravity-color.svg must have viewBox "0 0 540 540" to match antigravity-symbolic.svg');

    // Schemas verification (EGO-P-006): schemas/gschemas.compiled must NOT exist in the repository
    const compiledSchemaPath = GLib.build_filenamev([basePath, 'schemas', 'gschemas.compiled']);
    const compiledSchemaFile = Gio.File.new_for_path(compiledSchemaPath);
    assert(!compiledSchemaFile.query_exists(null),
        'EGO-P-006 violation: schemas/gschemas.compiled must not exist in the source repository');

    log('iconsConformity tests passed successfully');
}

runTests().catch(err => {
    log('iconsConformity test failed: ' + (err.stack || err));
    imports.system.exit(1);
});
