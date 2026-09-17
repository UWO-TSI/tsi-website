/** Keep render effects out of a lost WebGL context and resume after restoration. */
export function createGraphicsContextStore(context: { isContextLost: () => boolean }, canvas: EventTarget) {
  return {
    getSnapshot: () => !context.isContextLost(),
    subscribe: (notify: () => void) => {
      const lost = (event: Event) => { event.preventDefault(); notify(); };
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", notify);
      return () => {
        canvas.removeEventListener("webglcontextlost", lost);
        canvas.removeEventListener("webglcontextrestored", notify);
      };
    },
  };
}
