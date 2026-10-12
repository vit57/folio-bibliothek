// The same build can live at / or at a GitHub Pages repository path.
export const appBase=import.meta.env?.BASE_URL || '/';
export const appPath=path=>appBase+path.replace(/^\//,'');
