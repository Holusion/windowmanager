
declare var expect;

/**
 * Partial documentation of controller's config
 */
interface Config{
  headless ?:boolean;
  autoResize ?:boolean;
  logger ?:Logger.logger;
  shortcuts ?:Array<[string,string]>;
}

