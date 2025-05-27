export type LogLevel = 'debug' | 'info' | 'error'
const level = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info'

function shouldLog(target: LogLevel) {
  const order: LogLevel[] = ['debug', 'info', 'error']
  return order.indexOf(target) >= order.indexOf(level)
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog('debug') && console.debug(...args),
  info: (...args: unknown[]) => shouldLog('info') && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
}

