export const logger = {
  info: (msg: string) => console.info(msg),
  warn: (msg: string) => console.warn(msg),
  error: (msg: string, err?: unknown) => {
    console.error(msg);
    if (err) console.error(err);
  },
  success: (msg: string) => console.info(msg),
  debug: (msg: string) => {
    if (process.env.DEBUG) console.info(msg);
  },
};
