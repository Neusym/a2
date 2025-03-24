// This file provides state machine functionality for the workflow system
// In a production environment, this would likely use XState or a similar state machine library

type StateNode = {
  on?: Record<string, string>;
  type?: 'final';
};

type MachineConfig = {
  id: string;
  initial: string;
  states: Record<string, StateNode>;
};

type MachineState = {
  value: string;
  matches: (state: string) => boolean;
  context: Record<string, any>;
};

type MachineEvent = {
  type: string;
  [key: string]: any;
};

type Transition = {
  target: string;
  actions?: Array<(context: any, event: MachineEvent) => void>;
};

export function createMachine(config: MachineConfig) {
  const currentState = config.initial;
  const context: Record<string, any> = {};

  return {
    initialState: {
      value: config.initial,
      matches: (state: string) => state === config.initial,
      context,
    },

    transition(state: MachineState, event: MachineEvent): MachineState {
      const currentStateNode = config.states[state.value];
      const nextStateKey = currentStateNode?.on?.[event.type];

      if (!nextStateKey) {
        return state; // No transition defined for this event in current state
      }

      return {
        value: nextStateKey,
        matches: (stateValue: string) => stateValue === nextStateKey,
        context: { ...state.context },
      };
    },

    // For more complex state machine implementations, we'd add more methods
    // and functionality here, such as:
    // - Actions that execute during transitions
    // - Guards that conditionally allow transitions
    // - Services for invoking external processes
    // - Context manipulation

    getInitialState(): MachineState {
      return {
        value: config.initial,
        matches: (state: string) => state === config.initial,
        context,
      };
    },

    getStateNode(state: string): StateNode | undefined {
      return config.states[state];
    },

    isFinalState(state: string): boolean {
      return config.states[state]?.type === 'final';
    },
  };
}

// Helper types for the state machine
export type StateMachine = ReturnType<typeof createMachine>;
