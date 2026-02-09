import { MeshLineGeometry, MeshLineMaterial } from "meshline";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: any;
      meshLineMaterial: any;
    }
  }
}

export {};
