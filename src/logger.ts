/**
 * logger.ts - 统一日志记录工具
 */

let isLogEnabled = false;

/** 设置是否开启控制台日志打印 */
export function setLogEnabled(enabled: boolean): void {
  isLogEnabled = enabled;
}

/** 获取当前日志打印使能状态 */
export function getLogEnabled(): boolean {
  return isLogEnabled;
}

/**
 * 统一日志输出对象
 * 只有当 enableLog 为 true 时才会输出控制台日志
 */
export const logger = {
  log: (...args: any[]): void => {
    if (isLogEnabled) {
      console.log(...args);
    }
  },
  info: (...args: any[]): void => {
    if (isLogEnabled) {
      console.info(...args);
    }
  },
  warn: (...args: any[]): void => {
    if (isLogEnabled) {
      console.warn(...args);
    }
  },
  error: (...args: any[]): void => {
    if (isLogEnabled) {
      console.error(...args);
    }
  },
  debug: (...args: any[]): void => {
    if (isLogEnabled) {
      console.debug(...args);
    }
  },
};
