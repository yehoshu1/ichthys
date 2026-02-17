import { ComponentRouter } from './component-router';
import { registerEventComponentHandlers } from './handlers/event-components';
import { registerPollComponentHandlers } from './handlers/poll-components';
import { registerSetupComponentHandlers } from './handlers/setup-components';

const componentRouter = new ComponentRouter();
registerEventComponentHandlers(componentRouter);
registerPollComponentHandlers(componentRouter);
registerSetupComponentHandlers(componentRouter);

export { componentRouter };
