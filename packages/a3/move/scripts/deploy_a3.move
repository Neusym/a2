script {
    use a3::a3_manager;
    
    /// Deploy and initialize the A3 system
    public entry fun deploy_a3(
        admin: &signer,
        protocol_fee_percentage: u64,
        protocol_fee_recipient: address
    ) {
        // Initialize the A3 system
        a3_manager::initialize(
            admin, 
            protocol_fee_percentage, 
            protocol_fee_recipient
        );
    }
}
