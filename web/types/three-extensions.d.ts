declare module "three/webgpu" {
    export * from "three";
    export class WebGPURenderer {
        constructor(props?: any);
        toneMapping: any;
        outputColorSpace: any;
        toneMappingExposure: number;
        init(): Promise<void>;
    }
    export class PointsNodeMaterial {
        constructor(params?: any);
        positionNode: any;
        colorNode: any;
        transparent: boolean;
    }
    export class UniformNode<T> {
        value: T;
    }
    export class PostProcessing {
        constructor(renderer: WebGPURenderer);
        outputNode: any;
        render(): void;
        dispose(): void;
    }
    export class PassNode {
        getTextureNode(name: string): any;
    }
    export const ACESFilmicToneMapping: number;
    export const SRGBColorSpace: string;
}

declare module "three/tsl" {
    export function attribute(name: string): any;
    export function float(value: number): any;
    export function uniform(value: any): any;
    export function vec3(x: number, y: number, z: number): any;
    export function fract(value: any): any;
    export function smoothstep(edge0: any, edge1: any, x: any): any;
    export function pass(scene: any, camera: any): any;
}

declare module "three/examples/jsm/tsl/display/BloomNode.js" {
    export function bloom(input: any): any;
    export default class BloomNode {
        radius: { value: number };
        strength: { value: number };
        threshold: { value: number };
    }
}
