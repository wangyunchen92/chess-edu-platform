/**
 * Stockfish Web Worker wrapper
 *
 * stockfish.js (v10 npm版本) 是一个 self-contained 的 JS 文件。
 * 通过 importScripts 加载后，它会自行设置 onmessage 处理器
 * 并通过 postMessage 输出 UCI 响应。
 *
 * 因此本 worker 只需要 importScripts 即可，无需额外的消息转发逻辑。
 * stockfish.js 内部已经包含了完整的 Worker 通信协议：
 *   主线程 -> Worker: postMessage(uciCommand: string)
 *   Worker -> 主线程: postMessage(uciOutput: string)
 */

try {
  importScripts('./stockfish.js');
} catch (e) {
  // 如果加载失败，设置一个后备的 onmessage 回报错误
  postMessage('info string Error loading Stockfish: ' + e.message);
  console.error('[stockfish-worker] Failed to load Stockfish:', e);
}
