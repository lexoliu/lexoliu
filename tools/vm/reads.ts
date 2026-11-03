// Recording which blocks a v86 machine reads from its on-demand disk buffers.

/** v86's disk buffer cache granularity (src/buffer.js). */
export const BLOCK_SIZE = 256;

/** The members of v86's AsyncXHRPartfileBuffer (src/buffer.js) the recording uses. */
export interface DiskBuffer {
  get(offset: number, len: number, fn: (data: Uint8Array) => void, options?: unknown): void;
  get_from_cache(offset: number, len: number): Uint8Array | undefined;
}

export interface ReadLog {
  /** `performance.now()` of the latest read. */
  last: number;
  blocks: Set<number>;
  /** Reads the buffer's block cache could not serve. */
  misses: number;
}

export const newReadLog = (): ReadLog => ({ last: performance.now(), blocks: new Set<number>(), misses: 0 });

/** Records every read the IDE device makes from `buffer` into `log`. */
export function logReads(buffer: DiskBuffer, log: ReadLog): void {
  const get = buffer.get;
  buffer.get = function (offset, len, fn, options) {
    if (offset % BLOCK_SIZE !== 0 || len % BLOCK_SIZE !== 0) throw new Error(`disk read [${offset}, +${len}) is not block-aligned`);
    log.last = performance.now();
    for (let b = offset / BLOCK_SIZE; b < (offset + len) / BLOCK_SIZE; b++) log.blocks.add(b);
    if (!this.get_from_cache(offset, len)) log.misses++;
    get.call(this, offset, len, fn, options);
  };
}
