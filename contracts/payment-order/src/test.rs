#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, IntoVal,
};

struct Fixture {
    env: Env,
    contract_id: Address,
    payer: Address,
    recipient: Address,
    token: Address,
}

impl Fixture {
    fn client(&self) -> PaymentOrderClient<'_> {
        PaymentOrderClient::new(&self.env, &self.contract_id)
    }

    fn token_client(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token)
    }
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let contract_id = env.register(PaymentOrder, ());
    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token.address();
    let token_admin_client = StellarAssetClient::new(&env, &token_address);

    token_admin_client.mock_all_auths().mint(&payer, &1_000);
    let client = PaymentOrderClient::new(&env, &contract_id);
    client.initialize(&admin);

    Fixture {
        env,
        contract_id,
        payer,
        recipient,
        token: token_address,
    }
}

fn order_id(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn create_default_order(f: &Fixture, id: &BytesN<32>) {
    f.client()
        .create_order(id, &f.payer, &f.recipient, &f.token, &100, &2_000);
}

#[test]
fn initialize_succeeds_and_rejects_second_call() {
    let env = Env::default();
    let contract_id = env.register(PaymentOrder, ());
    let client = PaymentOrderClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_initialize(&admin);
    assert!(result.is_err());
}

#[test]
fn create_order_succeeds_and_stores_created_status() {
    let f = fixture();
    let id = order_id(&f.env, 1);

    create_default_order(&f, &id);
    let order = f.client().get_order(&id);

    assert_eq!(order.order_id, id);
    assert_eq!(order.payer, f.payer);
    assert_eq!(order.recipient, f.recipient);
    assert_eq!(order.token, f.token);
    assert_eq!(order.amount, 100);
    assert_eq!(order.deadline, 2_000);
    assert_eq!(order.status, Status::Created);
    assert_eq!(order.created_at, 1_000);
    assert_eq!(order.paid_at, None);
}

#[test]
fn create_order_rejects_invalid_inputs() {
    let f = fixture();
    let id = order_id(&f.env, 2);
    create_default_order(&f, &id);

    assert!(f
        .client()
        .try_create_order(&id, &f.payer, &f.recipient, &f.token, &100, &2_000)
        .is_err());
    assert!(f
        .client()
        .try_create_order(
            &order_id(&f.env, 3),
            &f.payer,
            &f.recipient,
            &f.token,
            &0,
            &2_000,
        )
        .is_err());
    assert!(f
        .client()
        .try_create_order(
            &order_id(&f.env, 4),
            &f.payer,
            &f.recipient,
            &f.token,
            &100,
            &999,
        )
        .is_err());
    assert!(f
        .client()
        .try_create_order(
            &order_id(&f.env, 5),
            &f.payer,
            &f.payer,
            &f.token,
            &100,
            &2_000,
        )
        .is_err());
}

#[test]
fn get_order_returns_error_for_missing_order() {
    let f = fixture();

    assert!(f.client().try_get_order(&order_id(&f.env, 6)).is_err());
}

#[test]
fn payer_can_pay_order_and_tokens_move_directly_to_recipient() {
    let f = fixture();
    let id = order_id(&f.env, 7);
    create_default_order(&f, &id);

    f.env.mock_all_auths();
    f.client().pay_order(&id);

    let order = f.client().get_order(&id);
    assert_eq!(order.status, Status::Paid);
    assert_eq!(order.paid_at, Some(1_000));
    assert_eq!(f.token_client().balance(&f.payer), 900);
    assert_eq!(f.token_client().balance(&f.recipient), 100);
    assert_eq!(f.token_client().balance(&f.contract_id), 0);
}

#[test]
fn pay_order_requires_payer_auth() {
    let f = fixture();
    let id = order_id(&f.env, 8);
    create_default_order(&f, &id);

    let result = f.client().try_pay_order(&id);

    assert!(result.is_err());
    assert_eq!(f.token_client().balance(&f.payer), 1_000);
    assert_eq!(f.token_client().balance(&f.recipient), 0);
}

#[test]
fn pay_order_rejects_missing_expired_paid_and_cancelled_orders() {
    let f = fixture();

    f.env.mock_all_auths();
    assert!(f.client().try_pay_order(&order_id(&f.env, 9)).is_err());

    let expired_id = order_id(&f.env, 10);
    f.client()
        .create_order(&expired_id, &f.payer, &f.recipient, &f.token, &100, &1_001);
    f.env.ledger().set_timestamp(1_002);
    assert!(f.client().try_pay_order(&expired_id).is_err());

    f.env.ledger().set_timestamp(1_000);
    let paid_id = order_id(&f.env, 11);
    create_default_order(&f, &paid_id);
    f.client().pay_order(&paid_id);
    assert!(f.client().try_pay_order(&paid_id).is_err());

    let cancelled_id = order_id(&f.env, 12);
    create_default_order(&f, &cancelled_id);
    f.client().cancel_order(&cancelled_id);
    assert!(f.client().try_pay_order(&cancelled_id).is_err());
}

#[test]
fn create_and_pay_order_succeeds_in_one_transaction() {
    let f = fixture();
    let id = order_id(&f.env, 13);

    f.env.mock_all_auths();
    f.client()
        .create_and_pay_order(&id, &f.payer, &f.recipient, &f.token, &250, &2_000);

    let order = f.client().get_order(&id);
    assert_eq!(order.status, Status::Paid);
    assert_eq!(order.created_at, 1_000);
    assert_eq!(order.paid_at, Some(1_000));
    assert_eq!(f.token_client().balance(&f.payer), 750);
    assert_eq!(f.token_client().balance(&f.recipient), 250);
    assert_eq!(f.token_client().balance(&f.contract_id), 0);
}

#[test]
fn create_and_pay_order_rejects_duplicate_and_invalid_inputs() {
    let f = fixture();
    let id = order_id(&f.env, 14);

    f.env.mock_all_auths();
    f.client()
        .create_and_pay_order(&id, &f.payer, &f.recipient, &f.token, &100, &2_000);

    assert!(f
        .client()
        .try_create_and_pay_order(&id, &f.payer, &f.recipient, &f.token, &100, &2_000)
        .is_err());
    assert!(f
        .client()
        .try_create_and_pay_order(
            &order_id(&f.env, 15),
            &f.payer,
            &f.recipient,
            &f.token,
            &-1,
            &2_000,
        )
        .is_err());
    assert!(f
        .client()
        .try_create_and_pay_order(
            &order_id(&f.env, 16),
            &f.payer,
            &f.recipient,
            &f.token,
            &100,
            &1_000,
        )
        .is_err());
}

#[test]
fn payer_can_cancel_created_order_without_token_transfer() {
    let f = fixture();
    let id = order_id(&f.env, 17);
    create_default_order(&f, &id);

    f.env.mock_all_auths();
    f.client().cancel_order(&id);

    let order = f.client().get_order(&id);
    assert_eq!(order.status, Status::Cancelled);
    assert_eq!(f.token_client().balance(&f.payer), 1_000);
    assert_eq!(f.token_client().balance(&f.recipient), 0);
}

#[test]
fn cancel_order_requires_payer_auth_and_valid_state() {
    let f = fixture();
    let id = order_id(&f.env, 18);
    create_default_order(&f, &id);

    assert!(f.client().try_cancel_order(&id).is_err());

    f.env.mock_all_auths();
    assert!(f.client().try_cancel_order(&order_id(&f.env, 19)).is_err());

    let paid_id = order_id(&f.env, 20);
    create_default_order(&f, &paid_id);
    f.client().pay_order(&paid_id);
    assert!(f.client().try_cancel_order(&paid_id).is_err());
}

#[test]
fn pay_order_requires_auth_from_stored_payer() {
    let f = fixture();
    let id = order_id(&f.env, 21);
    let other = Address::generate(&f.env);
    create_default_order(&f, &id);

    let _ = f
        .client()
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &other,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &f.contract_id,
                fn_name: "pay_order",
                args: (&id,).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .try_pay_order(&id)
        .unwrap_err();
}
