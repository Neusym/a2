module a3::payment {
    use std::string::{String};
    use std::signer;
    use std::error;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use a3::process_registry;
    
    /// Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_PROCESS_NOT_FOUND: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_PAYMENT_ALREADY_MADE: u64 = 4;
    const E_PAYMENT_NOT_REQUIRED: u64 = 5;
    const E_PAYMENT_NOT_FOUND: u64 = 6;
    const E_TASK_NOT_COMPLETED: u64 = 7;
    const E_PAYMENT_ALREADY_RELEASED: u64 = 8;
    
    /// Payment record
    struct Payment has key, store {
        process_id: String,
        task_id: String,
        payer: address,
        receiver: address,
        amount: u64,
        currency: String,
        status: u8, // 1 = escrow, 2 = completed, 3 = refunded
        payment_time: u64,
        expiration_time: u64,
    }
    
    /// Payment status constants
    const PAYMENT_STATUS_ESCROW: u8 = 1;
    const PAYMENT_STATUS_COMPLETED: u8 = 2;
    const PAYMENT_STATUS_REFUNDED: u8 = 3;
    
    /// Escrow resource to hold funds
    struct Escrow has key {
        coins: coin::Coin<AptosCoin>
    }
    
    /// Resource to store all payments
    struct PaymentStore has key {
        payments: vector<Payment>,
    }
    
    /// Events
    struct PaymentCreatedEvent has drop, store {
        process_id: String,
        task_id: String,
        payer: address,
        receiver: address,
        amount: u64,
        timestamp: u64,
    }
    
    struct PaymentCompletedEvent has drop, store {
        process_id: String,
        task_id: String,
        payer: address,
        receiver: address,
        amount: u64,
        timestamp: u64,
    }
    
    struct PaymentRefundedEvent has drop, store {
        process_id: String,
        task_id: String,
        payer: address,
        receiver: address,
        amount: u64,
        timestamp: u64,
    }
    
    /// Initialize module
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<PaymentStore>(account_addr)) {
            move_to(account, PaymentStore {
                payments: vector::empty<Payment>(),
            });
        };
    }
    
    /// Make a payment for a process that will be held in escrow
    public entry fun make_payment(
        account: &signer,
        process_id: String,
        task_id: String,
        amount: u64
    ) {
        let payer_addr = signer::address_of(account);
        
        // Check process exists and get owner
        assert!(process_registry::process_exists(process_id), error::not_found(E_PROCESS_NOT_FOUND));
        
        // Get process details to check pricing
        let (_, _, owner_addr, _, _, _, _, pricing_option, _, _) = process_registry::get_process(process_id);
        
        // Check if process requires payment
        assert!(option::is_some(&pricing_option), error::invalid_argument(E_PAYMENT_NOT_REQUIRED));
        
        let pricing = option::borrow(&pricing_option);
        let required_amount = pricing.task_price;
        let currency = pricing.currency;
        let requires_prepayment = pricing.requires_prepayment;
        
        // Check if prepayment is required
        assert!(requires_prepayment, error::invalid_argument(E_PAYMENT_NOT_REQUIRED));
        
        // Check if user has enough balance
        assert!(coin::balance<AptosCoin>(payer_addr) >= amount, error::invalid_state(E_INSUFFICIENT_BALANCE));
        
        // Check amount matches required amount
        assert!(amount >= required_amount, error::invalid_argument(E_INSUFFICIENT_BALANCE));
        
        // Check if payment already exists
        assert!(!payment_exists(process_id, task_id, payer_addr), error::already_exists(E_PAYMENT_ALREADY_MADE));
        
        // Withdraw funds from user and store in module escrow
        let escrow_coins = coin::withdraw<AptosCoin>(account, amount);
        
        // Store escrow under A3 module account
        if (!exists<Escrow>(@a3)) {
            let a3_account = account::create_signer_with_capability(
                &account::create_test_signer_cap(@a3)
            );
            move_to(&a3_account, Escrow { coins: escrow_coins });
        } else {
            let escrow = borrow_global_mut<Escrow>(@a3);
            coin::merge(&mut escrow.coins, escrow_coins);
        };
        
        // Create payment record
        let current_time = timestamp::now_seconds();
        let expiration_time = current_time + 604800; // 7 days expiration
        
        let payment = Payment {
            process_id,
            task_id,
            payer: payer_addr,
            receiver: owner_addr,
            amount,
            currency,
            status: PAYMENT_STATUS_ESCROW, // Mark as in escrow initially
            payment_time: current_time,
            expiration_time,
        };
        
        // Store payment
        if (!exists<PaymentStore>(@a3)) {
            let a3_account = account::create_signer_with_capability(
                &account::create_test_signer_cap(@a3)
            );
            move_to(&a3_account, PaymentStore {
                payments: vector::singleton(payment),
            });
        } else {
            let store = borrow_global_mut<PaymentStore>(@a3);
            vector::push_back(&mut store.payments, payment);
        };
        
        // Emit event
        event::emit(PaymentCreatedEvent {
            process_id,
            task_id,
            payer: payer_addr,
            receiver: owner_addr,
            amount,
            timestamp: current_time,
        });
    }
    
    /// Release payment from escrow after task completion and approval
    public entry fun release_payment(
        account: &signer,
        process_id: String,
        task_id: String
    ) {
        let payer_addr = signer::address_of(account);
        
        // Check payment exists
        assert!(payment_exists(process_id, task_id, payer_addr), error::not_found(E_PAYMENT_NOT_FOUND));
        
        // Get payment
        let store = borrow_global_mut<PaymentStore>(@a3);
        let payment_idx = find_payment_index(&store.payments, process_id, task_id, payer_addr);
        let payment = vector::borrow_mut(&mut store.payments, payment_idx);
        
        // Check payment is still in escrow
        assert!(payment.status == PAYMENT_STATUS_ESCROW, error::invalid_state(E_PAYMENT_ALREADY_RELEASED));
        
        // Get the funds from escrow
        let escrow = borrow_global_mut<Escrow>(@a3);
        let amount_to_release = payment.amount;
        let receiver_addr = payment.receiver;
        
        // Check if escrow has enough funds
        assert!(coin::value(&escrow.coins) >= amount_to_release, error::invalid_state(E_INSUFFICIENT_BALANCE));
        
        // Extract funds from escrow
        let coins_to_send = coin::extract(&mut escrow.coins, amount_to_release);
        
        // Update payment status
        payment.status = PAYMENT_STATUS_COMPLETED;
        
        // Transfer funds to receiver
        let receiver_account = account::create_signer_with_capability(
            &account::create_test_signer_cap(receiver_addr)
        );
        coin::deposit(receiver_addr, coins_to_send);
        
        // Emit event
        event::emit(PaymentCompletedEvent {
            process_id: payment.process_id,
            task_id: payment.task_id,
            payer: payment.payer,
            receiver: payment.receiver,
            amount: payment.amount,
            timestamp: timestamp::now_seconds(),
        });
    }
    
    /// Request refund for a payment
    public entry fun request_refund(
        account: &signer,
        process_id: String,
        task_id: String
    ) {
        let payer_addr = signer::address_of(account);
        
        // Check payment exists
        assert!(payment_exists(process_id, task_id, payer_addr), error::not_found(E_PAYMENT_NOT_FOUND));
        
        // Get payment
        let store = borrow_global_mut<PaymentStore>(@a3);
        let payment_idx = find_payment_index(&store.payments, process_id, task_id, payer_addr);
        let payment = vector::borrow_mut(&mut store.payments, payment_idx);
        
        // Check if payment is not already refunded
        assert!(payment.status != PAYMENT_STATUS_REFUNDED, error::invalid_state(E_PAYMENT_ALREADY_MADE));
        
        // Check if payment is still in escrow
        assert!(payment.status == PAYMENT_STATUS_ESCROW, error::invalid_state(E_PAYMENT_ALREADY_RELEASED));
        
        // Check if within refund period
        let current_time = timestamp::now_seconds();
        assert!(current_time <= payment.expiration_time, error::invalid_state(E_NOT_AUTHORIZED));
        
        // Get the funds from escrow
        let escrow = borrow_global_mut<Escrow>(@a3);
        let amount_to_refund = payment.amount;
        
        // Check if escrow has enough funds
        assert!(coin::value(&escrow.coins) >= amount_to_refund, error::invalid_state(E_INSUFFICIENT_BALANCE));
        
        // Extract funds from escrow
        let coins_to_refund = coin::extract(&mut escrow.coins, amount_to_refund);
        
        // Update payment status
        payment.status = PAYMENT_STATUS_REFUNDED;
        
        // Transfer funds back to payer
        coin::deposit(payer_addr, coins_to_refund);
        
        // Emit event
        event::emit(PaymentRefundedEvent {
            process_id: payment.process_id,
            task_id: payment.task_id,
            payer: payment.payer,
            receiver: payment.receiver,
            amount: payment.amount,
            timestamp: current_time,
        });
    }
    
    /// Verify if payment has been made for a process and task
    public fun verify_payment(process_id: String, task_id: String, payer_addr: address): bool {
        if (!exists<PaymentStore>(@a3)) {
            return false
        };
        
        let store = borrow_global<PaymentStore>(@a3);
        let payment_idx = find_payment_index(&store.payments, process_id, task_id, payer_addr);
        
        if (payment_idx >= vector::length(&store.payments)) {
            return false
        };
        
        let payment = vector::borrow(&store.payments, payment_idx);
        payment.status == PAYMENT_STATUS_ESCROW || payment.status == PAYMENT_STATUS_COMPLETED
    }
    
    /// Check if a payment exists
    public fun payment_exists(process_id: String, task_id: String, payer_addr: address): bool {
        if (!exists<PaymentStore>(@a3)) {
            return false
        };
        
        let store = borrow_global<PaymentStore>(@a3);
        find_payment_index(&store.payments, process_id, task_id, payer_addr) < vector::length(&store.payments)
    }
    
    /// Get payment details
    public fun get_payment(process_id: String, task_id: String, payer_addr: address): (
        String, String, address, address, u64, String, u8, u64, u64
    ) {
        assert!(payment_exists(process_id, task_id, payer_addr), error::not_found(E_PAYMENT_NOT_FOUND));
        
        let store = borrow_global<PaymentStore>(@a3);
        let payment_idx = find_payment_index(&store.payments, process_id, task_id, payer_addr);
        let payment = vector::borrow(&store.payments, payment_idx);
        
        (
            payment.process_id,
            payment.task_id,
            payment.payer,
            payment.receiver,
            payment.amount,
            payment.currency,
            payment.status,
            payment.payment_time,
            payment.expiration_time
        )
    }
    
    /// Helper function to find payment index in the vector
    fun find_payment_index(payments: &vector<Payment>, process_id: String, task_id: String, payer: address): u64 {
        let i = 0;
        let len = vector::length(payments);
        
        while (i < len) {
            let payment = vector::borrow(payments, i);
            if (payment.process_id == process_id && payment.task_id == task_id && payment.payer == payer) {
                return i
            };
            i = i + 1;
        };
        
        len // Return length if not found (will be handled as not found)
    }
} 