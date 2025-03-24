module a3::queue {
    use std::string::{String};
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use a3::process_registry;
    use a3::workflow;
    use a3::payment;
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_QUEUE_NOT_FOUND: u64 = 2;
    const E_QUEUE_ALREADY_EXISTS: u64 = 3;
    const E_TRANSACTION_NOT_FOUND: u64 = 4;
    const E_INVALID_TRANSACTION_STATUS: u64 = 5;
    const E_PAYMENT_REQUIRED: u64 = 6;
    const E_PROCESS_NOT_FOUND: u64 = 7;
    
    /// Transaction status
    const TRANSACTION_STATUS_PENDING: u8 = 0;
    const TRANSACTION_STATUS_PROCESSING: u8 = 1;
    const TRANSACTION_STATUS_COMPLETED: u8 = 2;
    const TRANSACTION_STATUS_FAILED: u8 = 3;
    const TRANSACTION_STATUS_CANCELED: u8 = 4;
    
    /// Transaction priority
    const PRIORITY_LOW: u8 = 0;
    const PRIORITY_NORMAL: u8 = 1;
    const PRIORITY_HIGH: u8 = 2;
    const PRIORITY_URGENT: u8 = 3;
    
    /// Transaction structure
    struct Transaction has key, store {
        id: String,
        process_id: String,
        workflow_id: Option<String>,
        task_id: Option<String>,
        sender: address,
        status: u8,
        priority: u8,
        data: vector<u8>, // Serialized transaction data
        created_at: u64,
        updated_at: u64,
    }
    
    /// Queue structure
    struct TransactionQueue has key {
        name: String,
        owner: address,
        transactions: vector<Transaction>,
        processing_limit: u64, // Max number of transactions to process simultaneously
        created_at: u64,
        updated_at: u64,
    }
    
    /// Events
    struct TransactionSubmittedEvent has drop, store {
        transaction_id: String,
        process_id: String,
        sender: address,
        priority: u8,
        timestamp: u64,
    }
    
    struct TransactionStatusChangedEvent has drop, store {
        transaction_id: String,
        process_id: String,
        old_status: u8,
        new_status: u8,
        timestamp: u64,
    }
    
    /// Initialize a new queue
    public entry fun initialize_queue(
        account: &signer,
        queue_name: String,
        processing_limit: u64
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if queue already exists
        assert!(!exists<TransactionQueue>(account_addr), error::already_exists(E_QUEUE_ALREADY_EXISTS));
        
        let current_time = timestamp::now_seconds();
        
        // Create the queue
        let queue = TransactionQueue {
            name: queue_name,
            owner: account_addr,
            transactions: vector::empty<Transaction>(),
            processing_limit,
            created_at: current_time,
            updated_at: current_time,
        };
        
        // Store queue
        move_to(account, queue);
    }
    
    /// Submit a transaction to the queue
    public entry fun submit_transaction(
        account: &signer,
        process_id: String,
        transaction_id: String,
        workflow_id_option: Option<String>,
        task_id_option: Option<String>,
        priority: u8,
        data: vector<u8>
    ) {
        let sender_addr = signer::address_of(account);
        
        // Check process exists
        assert!(process_registry::process_exists(process_id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get process details
        let (_, _, process_owner, _, _, _, _, pricing_option, _, _) = process_registry::get_process(process_id);
        
        // Check if payment is required and made
        if (option::is_some(&pricing_option)) {
            let pricing = option::borrow(&pricing_option);
            if (pricing.requires_prepayment) {
                assert!(payment::verify_payment(process_id, sender_addr), error::invalid_state(E_PAYMENT_REQUIRED));
            };
        };
        
        // Validate priority
        assert!(
            priority == PRIORITY_LOW ||
            priority == PRIORITY_NORMAL ||
            priority == PRIORITY_HIGH ||
            priority == PRIORITY_URGENT,
            error::invalid_argument(E_INVALID_TRANSACTION_STATUS)
        );
        
        // Create transaction
        let current_time = timestamp::now_seconds();
        let transaction = Transaction {
            id: transaction_id,
            process_id,
            workflow_id: workflow_id_option,
            task_id: task_id_option,
            sender: sender_addr,
            status: TRANSACTION_STATUS_PENDING,
            priority,
            data,
            created_at: current_time,
            updated_at: current_time,
        };
        
        // Add to queue
        assert!(exists<TransactionQueue>(process_owner), error::not_found(E_QUEUE_NOT_FOUND));
        
        let queue = borrow_global_mut<TransactionQueue>(process_owner);
        vector::push_back(&mut queue.transactions, transaction);
        queue.updated_at = current_time;
        
        // Emit event
        event::emit(TransactionSubmittedEvent {
            transaction_id,
            process_id,
            sender: sender_addr,
            priority,
            timestamp: current_time,
        });
    }
    
    /// Update transaction status
    public entry fun update_transaction_status(
        account: &signer,
        transaction_id: String,
        new_status: u8
    ) {
        let account_addr = signer::address_of(account);
        
        // Check if queue exists
        assert!(exists<TransactionQueue>(account_addr), error::not_found(E_QUEUE_NOT_FOUND));
        
        // Get queue
        let queue = borrow_global_mut<TransactionQueue>(account_addr);
        
        // Find transaction
        let transaction_idx = find_transaction_index(&queue.transactions, transaction_id);
        assert!(transaction_idx < vector::length(&queue.transactions), error::not_found(E_TRANSACTION_NOT_FOUND));
        
        let transaction = vector::borrow_mut(&mut queue.transactions, transaction_idx);
        
        // Validate status
        assert!(
            new_status == TRANSACTION_STATUS_PENDING ||
            new_status == TRANSACTION_STATUS_PROCESSING ||
            new_status == TRANSACTION_STATUS_COMPLETED ||
            new_status == TRANSACTION_STATUS_FAILED ||
            new_status == TRANSACTION_STATUS_CANCELED,
            error::invalid_argument(E_INVALID_TRANSACTION_STATUS)
        );
        
        // Save old status for event
        let old_status = transaction.status;
        
        // Update status and timestamp
        transaction.status = new_status;
        transaction.updated_at = timestamp::now_seconds();
        queue.updated_at = transaction.updated_at;
        
        // Update workflow task status if applicable
        if (new_status == TRANSACTION_STATUS_COMPLETED && 
            option::is_some(&transaction.workflow_id) && 
            option::is_some(&transaction.task_id)) {
            
            // This part would typically update the workflow task status
            // but we just emit the event for now since we'd need to call other modules
        };
        
        // Emit event
        event::emit(TransactionStatusChangedEvent {
            transaction_id: transaction.id,
            process_id: transaction.process_id,
            old_status,
            new_status,
            timestamp: transaction.updated_at,
        });
    }
    
    /// Cancel a transaction
    public entry fun cancel_transaction(
        account: &signer,
        transaction_id: String
    ) {
        let sender_addr = signer::address_of(account);
        
        // Find the queue that contains this transaction
        let (queue_owner, transaction_idx) = find_transaction_owner_and_index(transaction_id);
        
        // Get queue
        let queue = borrow_global_mut<TransactionQueue>(queue_owner);
        let transaction = vector::borrow_mut(&mut queue.transactions, transaction_idx);
        
        // Only sender or queue owner can cancel
        assert!(
            transaction.sender == sender_addr || queue.owner == sender_addr,
            error::permission_denied(E_NOT_AUTHORIZED)
        );
        
        // Only pending or processing transactions can be canceled
        assert!(
            transaction.status == TRANSACTION_STATUS_PENDING || 
            transaction.status == TRANSACTION_STATUS_PROCESSING,
            error::invalid_state(E_INVALID_TRANSACTION_STATUS)
        );
        
        // Save old status for event
        let old_status = transaction.status;
        
        // Update status and timestamp
        transaction.status = TRANSACTION_STATUS_CANCELED;
        transaction.updated_at = timestamp::now_seconds();
        queue.updated_at = transaction.updated_at;
        
        // Emit event
        event::emit(TransactionStatusChangedEvent {
            transaction_id: transaction.id,
            process_id: transaction.process_id,
            old_status,
            new_status: TRANSACTION_STATUS_CANCELED,
            timestamp: transaction.updated_at,
        });
    }
    
    /// Get next transaction to process
    public fun get_next_transaction(owner: address): (String, String, Option<String>, Option<String>, address, vector<u8>) {
        assert!(exists<TransactionQueue>(owner), error::not_found(E_QUEUE_NOT_FOUND));
        
        let queue = borrow_global<TransactionQueue>(owner);
        
        // Find highest priority pending transaction
        let best_idx = find_highest_priority_pending_transaction(&queue.transactions);
        assert!(best_idx < vector::length(&queue.transactions), error::not_found(E_TRANSACTION_NOT_FOUND));
        
        let transaction = vector::borrow(&queue.transactions, best_idx);
        
        (
            transaction.id,
            transaction.process_id,
            transaction.workflow_id,
            transaction.task_id,
            transaction.sender,
            transaction.data
        )
    }
    
    /// Get transaction count in queue
    public fun get_queue_size(owner: address): u64 {
        if (!exists<TransactionQueue>(owner)) {
            return 0
        };
        
        let queue = borrow_global<TransactionQueue>(owner);
        vector::length(&queue.transactions)
    }
    
    /// Get pending transaction count
    public fun get_pending_transaction_count(owner: address): u64 {
        if (!exists<TransactionQueue>(owner)) {
            return 0
        };
        
        let queue = borrow_global<TransactionQueue>(owner);
        let count = 0;
        let i = 0;
        let len = vector::length(&queue.transactions);
        
        while (i < len) {
            let transaction = vector::borrow(&queue.transactions, i);
            if (transaction.status == TRANSACTION_STATUS_PENDING) {
                count = count + 1;
            };
            i = i + 1;
        };
        
        count
    }
    
    /// Helper function to find transaction in any queue
    fun find_transaction_owner_and_index(transaction_id: String): (address, u64) {
        // This is simplified - in a real implementation we would need
        // a global registry of all queues or transactions to find it
        // For now, we just check the a3 module account
        
        assert!(exists<TransactionQueue>(@a3), error::not_found(E_QUEUE_NOT_FOUND));
        
        let queue = borrow_global<TransactionQueue>(@a3);
        let idx = find_transaction_index(&queue.transactions, transaction_id);
        
        assert!(idx < vector::length(&queue.transactions), error::not_found(E_TRANSACTION_NOT_FOUND));
        
        (@a3, idx)
    }
    
    /// Helper function to find transaction index in queue
    fun find_transaction_index(transactions: &vector<Transaction>, transaction_id: String): u64 {
        let i = 0;
        let len = vector::length(transactions);
        
        while (i < len) {
            let transaction = vector::borrow(transactions, i);
            if (transaction.id == transaction_id) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found
    }
    
    /// Helper function to find highest priority pending transaction
    fun find_highest_priority_pending_transaction(transactions: &vector<Transaction>): u64 {
        let i = 0;
        let len = vector::length(transactions);
        let best_idx = len; // Default to not found
        let best_priority = PRIORITY_LOW - 1; // Lower than the lowest
        
        while (i < len) {
            let transaction = vector::borrow(transactions, i);
            if (transaction.status == TRANSACTION_STATUS_PENDING && 
                transaction.priority > best_priority) {
                best_idx = i;
                best_priority = transaction.priority;
            };
            i = i + 1;
        };
        
        best_idx
    }
} 