/**
 * Safari/WebKit ships ReadableStream but not async iteration until a late
 * Safari 26.x. @apeira/core does `for await (const event of result.eventStream)`.
 */
type AsyncIterableReadableStreamPrototype = typeof ReadableStream.prototype & {
  [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
};

export function installReadableStreamAsyncIterator(): void {
  if (typeof ReadableStream === "undefined") {
    return;
  }
  const proto = ReadableStream.prototype as AsyncIterableReadableStreamPrototype;
  if (typeof proto[Symbol.asyncIterator] === "function") {
    return;
  }

  async function* readableStreamAsyncIterator(this: ReadableStream<unknown>): AsyncGenerator<unknown> {
    const reader = this.getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) {
          return;
        }
        yield result.value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  Object.defineProperty(proto, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: readableStreamAsyncIterator
  });
}

installReadableStreamAsyncIterator();
