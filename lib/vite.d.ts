import type { Plugin } from 'vite';
export interface VisualEditOptions { allowedOrigins?: string[] }
export declare function visualEdit(options?: VisualEditOptions): Plugin;
export default visualEdit;
