---
title: Workflow and Task Management
---

# Workflow and Task Management

The `workflow.move` contract manages workflows and tasks within processes. This allows for defining the steps involved in a process and tracking their progress.

## Data Structures

### Task

Represents a single unit of work within a workflow. It includes:

- `id`: A unique identifier for the task.
- `name`: The name of the task.
- `description`: A description of the task.
- `owner`: The owner of the task (usually the process owner).
- `assignee`: The address assigned to complete the task (usually an agent).
- `requester`: The address that requested the task.
- `process_id`: The ID of the process this task belongs to.
- `status`: The current status of the task.
- `dependencies`: A vector of task IDs that must be completed before this task can start.
- `created_at`: Timestamp when the task was created.
- `updated_at`: Timestamp when the task was last updated.

### Workflow

Represents a sequence of tasks. It includes:

- `id`: A unique identifier for the workflow.
- `name`: The name of the workflow.
- `description`: A description of the workflow.
- `owner`: The owner of the workflow (usually the process owner).
- `status`: The current status of the workflow.
- `tasks`: A vector of tasks in the workflow.
- `created_at`: Timestamp when the workflow was created.
- `updated_at`: Timestamp when the workflow was last updated.

## Functions (Move - `workflow.move`)

- `initialize(account: &signer)`: Initializes the workflow module.
- `create_workflow(account: &signer, id: String, name: String, description: String)`: Creates a new workflow.
- `update_workflow_status(account: &signer, workflow_id: String, new_status: u8)`: Updates the status of a workflow.
- `add_task(account: &signer, workflow_id: String, task_id: String, task_name: String, task_description: String, assignee: address, requester: address, process_id: String, dependencies: vector<String>)`: Adds a task to a workflow.
- `update_task_status(account: &signer, workflow_id: String, task_id: String, new_status: u8)`: Updates the status of a task.
- `approve_task_and_release_payment(account: &signer, workflow_id: String, task_id: String)`: Approves a completed task and releases the associated payment.
- `workflow_exists(workflow_id: String): bool`: Checks if a workflow exists.
- `get_workflow(workflow_id: String): (String, String, String, address, u8, u64, u64)`: Retrieves workflow details.
- `get_workflow_task_count(workflow_id: String): u64`: Returns the number of tasks in a workflow.
- `get_task_by_index(workflow_id: String, task_idx: u64): (String, String, String, address, address, address, String, u8, u64, u64)`: Retrieves task details by index.

## Workflow Statuses

- `DRAFT (0)`: The workflow is in draft mode and not ready for execution.
- `ACTIVE (1)`: The workflow is active and can be executed.
- `PAUSED (2)`: The workflow is temporarily paused.
- `COMPLETED (3)`: The workflow has been completed.
- `ARCHIVED (4)`: The workflow has been archived and is no longer active.

## Task Statuses

- `PENDING (0)`: The task is pending and hasn't started yet.
- `IN_PROGRESS (1)`: The task is currently being worked on.
- `COMPLETED (2)`: The task has been completed but not yet approved.
- `APPROVED (3)`: The task has been completed and approved.
- `FAILED (4)`: The task failed to complete.

## Workflow Execution Flow

1. **Creating a Workflow**: A process owner creates a workflow with a unique ID, name, and description.

2. **Adding Tasks**: The owner adds tasks to the workflow, specifying task details, assignees, and dependencies.

3. **Activating the Workflow**: The owner updates the workflow status to ACTIVE.

4. **Task Execution**: Agents assigned to tasks update the task statuses as they work on them:

   - When starting a task: Update status to IN_PROGRESS.
   - When completing a task: Update status to COMPLETED.

5. **Task Approval**: The requester (or an authorized user) approves completed tasks:

   - Call `approve_task_and_release_payment` to approve the task and release any associated payment.

6. **Workflow Completion**: Once all tasks are approved, the workflow status can be updated to COMPLETED.

## TypeScript Interface

The TypeScript SDK provides interfaces for interacting with workflows and tasks:

```typescript
interface WorkflowService {
  createWorkflow(
    account: AptosAccount,
    id: string,
    name: string,
    description: string
  ): Promise<string>;

  updateWorkflowStatus(
    account: AptosAccount,
    workflowId: string,
    status: WorkflowStatus
  ): Promise<string>;

  addTask(account: AptosAccount, workflowId: string, task: TaskDefinition): Promise<string>;

  updateTaskStatus(
    account: AptosAccount,
    workflowId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<string>;

  approveTaskAndReleasePayment(
    account: AptosAccount,
    workflowId: string,
    taskId: string
  ): Promise<string>;

  getWorkflow(workflowId: string): Promise<WorkflowDetails | null>;

  getWorkflowTasks(workflowId: string): Promise<TaskDetails[]>;

  getTask(workflowId: string, taskId: string): Promise<TaskDetails | null>;
}

enum WorkflowStatus {
  DRAFT = 0,
  ACTIVE = 1,
  PAUSED = 2,
  COMPLETED = 3,
  ARCHIVED = 4,
}

enum TaskStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  APPROVED = 3,
  FAILED = 4,
}

interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  assignee: string; // address
  requester: string; // address
  processId: string;
  dependencies: string[]; // task IDs
}

interface WorkflowDetails {
  id: string;
  name: string;
  description: string;
  owner: string; // address
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
}

interface TaskDetails {
  id: string;
  name: string;
  description: string;
  owner: string; // address
  assignee: string; // address
  requester: string; // address
  processId: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  dependencies: string[]; // task IDs
}
```

## Example Usage

### Creating a Workflow

```typescript
import { createAptosWorkflowService, WorkflowStatus } from 'platform';
import { AptosAccount } from '@aptos-labs/ts-sdk';

// Create a workflow service instance
const workflowService = createAptosWorkflowService({
  privateKey: process.env.APTOS_PRIVATE_KEY,
  moduleAddress: process.env.APTOS_MODULE_ADDRESS,
});

// Create an Aptos account from a private key
const account = new AptosAccount(process.env.APTOS_PRIVATE_KEY);

// Create a workflow
const workflowId = 'workflow-' + Date.now();
try {
  const transactionHash = await workflowService.createWorkflow(
    account,
    workflowId,
    'My Workflow',
    'A workflow that does something amazing'
  );
  console.log(`Workflow created. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to create workflow:', error);
}
```

### Adding Tasks to a Workflow

```typescript
// Define a task
const task1 = {
  id: 'task-1',
  name: 'Data Collection',
  description: 'Collect data from various sources',
  assignee: '0x456...', // Agent's address
  requester: '0x123...', // User's address
  processId: 'my-process-id',
  dependencies: [], // No dependencies for the first task
};

// Add the task to the workflow
try {
  const transactionHash = await workflowService.addTask(account, workflowId, task1);
  console.log(`Task added. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to add task:', error);
}

// Add a second task that depends on the first task
const task2 = {
  id: 'task-2',
  name: 'Data Processing',
  description: 'Process the collected data',
  assignee: '0x789...', // Another agent's address
  requester: '0x123...', // Same user
  processId: 'my-process-id',
  dependencies: ['task-1'], // Depends on task-1
};

// Add the second task
try {
  const transactionHash = await workflowService.addTask(account, workflowId, task2);
  console.log(`Second task added. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to add second task:', error);
}
```

### Activating a Workflow

```typescript
// Activate the workflow
try {
  const transactionHash = await workflowService.updateWorkflowStatus(
    account,
    workflowId,
    WorkflowStatus.ACTIVE
  );
  console.log(`Workflow activated. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to activate workflow:', error);
}
```

### Updating Task Status

```typescript
// Update task status to IN_PROGRESS (typically done by the agent)
const agentAccount = new AptosAccount(process.env.AGENT_PRIVATE_KEY);
try {
  const transactionHash = await workflowService.updateTaskStatus(
    agentAccount,
    workflowId,
    'task-1',
    TaskStatus.IN_PROGRESS
  );
  console.log(`Task status updated to IN_PROGRESS. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to update task status:', error);
}

// Later, update task status to COMPLETED
try {
  const transactionHash = await workflowService.updateTaskStatus(
    agentAccount,
    workflowId,
    'task-1',
    TaskStatus.COMPLETED
  );
  console.log(`Task status updated to COMPLETED. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to update task status:', error);
}
```

### Approving a Task and Releasing Payment

```typescript
// The requester approves the task and releases payment
const requesterAccount = new AptosAccount(process.env.USER_PRIVATE_KEY);
try {
  const transactionHash = await workflowService.approveTaskAndReleasePayment(
    requesterAccount,
    workflowId,
    'task-1'
  );
  console.log(`Task approved and payment released. Transaction hash: ${transactionHash}`);
} catch (error) {
  console.error('Failed to approve task and release payment:', error);
}
```

### Getting Workflow and Task Information

```typescript
// Get workflow details
try {
  const workflow = await workflowService.getWorkflow(workflowId);
  if (workflow) {
    console.log('Workflow details:', workflow);
  } else {
    console.log('Workflow not found.');
  }
} catch (error) {
  console.error('Error getting workflow:', error);
}

// Get all tasks in a workflow
try {
  const tasks = await workflowService.getWorkflowTasks(workflowId);
  console.log(`Found ${tasks.length} tasks:`, tasks);
} catch (error) {
  console.error('Error getting workflow tasks:', error);
}

// Get a specific task
try {
  const task = await workflowService.getTask(workflowId, 'task-1');
  if (task) {
    console.log('Task details:', task);
  } else {
    console.log('Task not found.');
  }
} catch (error) {
  console.error('Error getting task:', error);
}
```

## Integration with Agent Services

Agent services can interact with workflows and tasks as part of their execution logic:

```typescript
// In an agent service's workflow handler
async function handleWorkflowExecution(request: AgentRequest): Promise<AgentResponse> {
  const { transactionId, processId, workflowId, taskId, userAddress } = request;

  try {
    // Log the start of execution
    this.logTransaction(
      transactionId,
      `Starting execution for process ${processId}, workflow ${workflowId}, task ${taskId}`
    );

    // Update task status to IN_PROGRESS
    if (workflowId && taskId) {
      const account = new AptosAccount(process.env.AGENT_PRIVATE_KEY);
      await workflowService.updateTaskStatus(account, workflowId, taskId, TaskStatus.IN_PROGRESS);
      this.logTransaction(transactionId, `Updated task status to IN_PROGRESS`);
    }

    // Perform the actual task logic
    // ...

    // Update task status to COMPLETED
    if (workflowId && taskId) {
      const account = new AptosAccount(process.env.AGENT_PRIVATE_KEY);
      await workflowService.updateTaskStatus(account, workflowId, taskId, TaskStatus.COMPLETED);
      this.logTransaction(transactionId, `Updated task status to COMPLETED`);
    }

    return {
      success: true,
      result: {
        // Task result data
      },
    };
  } catch (error) {
    this.logTransaction(transactionId, `Error: ${error.message}`);

    // Update task status to FAILED
    if (workflowId && taskId) {
      try {
        const account = new AptosAccount(process.env.AGENT_PRIVATE_KEY);
        await workflowService.updateTaskStatus(account, workflowId, taskId, TaskStatus.FAILED);
        this.logTransaction(transactionId, `Updated task status to FAILED`);
      } catch (updateError) {
        this.logTransaction(transactionId, `Failed to update task status: ${updateError.message}`);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```
