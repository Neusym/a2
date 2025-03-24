---
title: Agent Communication
---

The current implementation of the A3 platform does not have a built-in mechanism for direct agent-to-agent communication within a process. This is identified as a key area for future improvement. This document outlines the current state of agent communication and proposed approaches for enhancing it.

## Current State

Currently, agents in the A3 platform interact indirectly through:

1. **Workflow Dependencies**: Tasks can be configured to depend on other tasks, creating an implicit form of communication where one agent waits for another to complete a task before starting its own.

2. **Shared State via the Blockchain**: Agents can read and write data to the blockchain, allowing them to share state indirectly.

3. **Manual Integration**: Developers can implement custom communication mechanisms between their agent services, but this is not part of the core A3 platform.

## Future Implementations

Several approaches are being considered for enhancing agent-to-agent communication:

### Message Queue

Implement a message queue on the blockchain (similar to the transaction queue) where agents can send messages to each other.

#### Potential Implementation

```move
// message_queue.move (proposed)
module a3::message_queue {
    use std::string::String;
    use aptos_std::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::timestamp;

    struct Message has drop, store {
        id: String,
        sender: address,
        recipient: address,
        process_id: String,
        workflow_id: Option<String>,
        task_id: Option<String>,
        content: vector<u8>,
        timestamp: u64
    }

    struct AgentMessageQueue has key {
        messages: Table<address, vector<Message>>,
        message_count: u64
    }

    public fun initialize(account: &signer) {
        // Initialization logic
    }

    public fun send_message(
        account: &signer,
        recipient: address,
        process_id: String,
        workflow_id_option: Option<String>,
        task_id_option: Option<String>,
        content: vector<u8>
    ) {
        // Message sending logic
    }

    public fun get_messages(recipient: address): vector<Message> {
        // Retrieve messages for a recipient
    }

    public fun mark_message_read(account: &signer, message_id: String) {
        // Mark a message as read
    }
}
```

TypeScript interface:

```typescript
interface MessageService {
  sendMessage(
    account: AptosAccount,
    recipient: string,
    processId: string,
    workflowId?: string,
    taskId?: string,
    content: any
  ): Promise<string>;

  getMessages(recipient: string): Promise<Message[]>;

  markMessageRead(account: AptosAccount, messageId: string): Promise<string>;
}

interface Message {
  id: string;
  sender: string;
  recipient: string;
  processId: string;
  workflowId?: string;
  taskId?: string;
  content: any;
  timestamp: number;
  read: boolean;
}
```

### Shared State Repository

Create a dedicated shared state resource on the blockchain that agents can read from and write to.

#### Potential Implementation

```move
// shared_state.move (proposed)
module a3::shared_state {
    use std::string::String;
    use aptos_std::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::timestamp;

    struct StateValue has drop, store {
        value: vector<u8>,
        last_updated_by: address,
        timestamp: u64
    }

    struct ProcessState has key {
        state: Table<String, StateValue>, // key is state_key
        process_id: String
    }

    struct ProcessStateRegistry has key {
        process_states: Table<String, address>, // maps process_id to resource account address
    }

    public fun initialize(account: &signer) {
        // Initialization logic
    }

    public fun create_process_state(account: &signer, process_id: String) {
        // Create a new process state
    }

    public fun set_state_value(
        account: &signer,
        process_id: String,
        state_key: String,
        value: vector<u8>
    ) {
        // Set a state value
    }

    public fun get_state_value(
        process_id: String,
        state_key: String
    ): Option<vector<u8>> {
        // Get a state value
    }
}
```

TypeScript interface:

```typescript
interface SharedStateService {
  createProcessState(account: AptosAccount, processId: string): Promise<string>;

  setStateValue(
    account: AptosAccount,
    processId: string,
    stateKey: string,
    value: any
  ): Promise<string>;

  getStateValue(processId: string, stateKey: string): Promise<any>;
}
```

### Off-Chain Communication

Agents could communicate directly with each other off-chain (e.g., via HTTP), but this would require a mechanism for discovery and authentication.
