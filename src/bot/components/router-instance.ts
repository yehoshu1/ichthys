import { ComponentRouter } from './component-router';
import { registerEventComponentHandlers } from './handlers/event-components';
import { registerPollComponentHandlers } from './handlers/poll-components';

const componentRouter = new ComponentRouter();
registerEventComponentHandlers(componentRouter);
registerPollComponentHandlers(componentRouter);

export { componentRouter };
