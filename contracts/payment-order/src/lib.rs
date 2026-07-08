#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN, Env,
};

#[cfg(test)]
mod test;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum Status {
    Created,
    Paid,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Order {
    pub order_id: BytesN<32>,
    pub payer: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub deadline: u64,
    pub status: Status,
    pub created_at: u64,
    pub paid_at: Option<u64>,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Order(BytesN<32>),
}

#[contractevent(topics = ["initialized"])]
pub struct Initialized {
    #[topic]
    pub admin: Address,
}

#[contractevent(topics = ["order_created"])]
pub struct OrderCreated {
    #[topic]
    pub order_id: BytesN<32>,
    pub payer: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub deadline: u64,
}

#[contractevent(topics = ["order_paid"])]
pub struct OrderPaid {
    #[topic]
    pub order_id: BytesN<32>,
    pub payer: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractevent(topics = ["order_cancelled"])]
pub struct OrderCancelled {
    #[topic]
    pub order_id: BytesN<32>,
    pub payer: Address,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    OrderAlreadyExists = 3,
    OrderNotFound = 4,
    InvalidAmount = 5,
    InvalidDeadline = 6,
    SamePayerAndRecipient = 7,
    OrderExpired = 8,
    InvalidStatus = 9,
}

#[contract]
pub struct PaymentOrder;

#[contractimpl]
impl PaymentOrder {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        let key = DataKey::Admin;
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().persistent().set(&key, &admin);
        Initialized { admin }.publish(&env);
        Ok(())
    }

    pub fn create_order(
        env: Env,
        order_id: BytesN<32>,
        payer: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        Self::validate_new_order(&env, &order_id, &payer, &recipient, amount, deadline)?;

        let now = env.ledger().timestamp();
        let order = Order {
            order_id: order_id.clone(),
            payer: payer.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            amount,
            deadline,
            status: Status::Created,
            created_at: now,
            paid_at: None,
        };

        Self::save_order(&env, &order_id, &order);
        Self::emit_order_created(&env, order_id, payer, recipient, token, amount, deadline);
        Ok(())
    }

    pub fn pay_order(env: Env, order_id: BytesN<32>) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let mut order = Self::load_order(&env, &order_id)?;

        order.payer.require_auth();
        Self::ensure_payable(&env, &order)?;

        Self::transfer_direct(&env, &order);

        let now = env.ledger().timestamp();
        order.status = Status::Paid;
        order.paid_at = Some(now);
        Self::save_order(&env, &order_id, &order);
        Self::emit_order_paid(
            &env,
            order_id,
            order.payer,
            order.recipient,
            order.token,
            order.amount,
        );
        Ok(())
    }

    pub fn create_and_pay_order(
        env: Env,
        order_id: BytesN<32>,
        payer: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        Self::validate_new_order(&env, &order_id, &payer, &recipient, amount, deadline)?;

        payer.require_auth();

        let now = env.ledger().timestamp();
        let order = Order {
            order_id: order_id.clone(),
            payer: payer.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            amount,
            deadline,
            status: Status::Paid,
            created_at: now,
            paid_at: Some(now),
        };

        Self::transfer_direct(&env, &order);
        Self::save_order(&env, &order_id, &order);
        Self::emit_order_created(
            &env,
            order_id.clone(),
            payer.clone(),
            recipient.clone(),
            token.clone(),
            amount,
            deadline,
        );
        Self::emit_order_paid(&env, order_id, payer, recipient, token, amount);
        Ok(())
    }

    pub fn cancel_order(env: Env, order_id: BytesN<32>) -> Result<(), Error> {
        Self::require_initialized(&env)?;
        let mut order = Self::load_order(&env, &order_id)?;

        order.payer.require_auth();
        if order.status != Status::Created {
            return Err(Error::InvalidStatus);
        }

        order.status = Status::Cancelled;
        Self::save_order(&env, &order_id, &order);
        OrderCancelled {
            order_id,
            payer: order.payer.clone(),
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_order(env: Env, order_id: BytesN<32>) -> Result<Order, Error> {
        Self::require_initialized(&env)?;
        Self::load_order(&env, &order_id)
    }
}

impl PaymentOrder {
    fn require_initialized(env: &Env) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            Ok(())
        } else {
            Err(Error::NotInitialized)
        }
    }

    fn validate_new_order(
        env: &Env,
        order_id: &BytesN<32>,
        payer: &Address,
        recipient: &Address,
        amount: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        if env
            .storage()
            .persistent()
            .has(&DataKey::Order(order_id.clone()))
        {
            return Err(Error::OrderAlreadyExists);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(Error::InvalidDeadline);
        }
        if payer == recipient {
            return Err(Error::SamePayerAndRecipient);
        }
        Ok(())
    }

    fn ensure_payable(env: &Env, order: &Order) -> Result<(), Error> {
        if order.status != Status::Created {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() > order.deadline {
            return Err(Error::OrderExpired);
        }
        Ok(())
    }

    fn load_order(env: &Env, order_id: &BytesN<32>) -> Result<Order, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Order(order_id.clone()))
            .ok_or(Error::OrderNotFound)
    }

    fn save_order(env: &Env, order_id: &BytesN<32>, order: &Order) {
        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id.clone()), order);
    }

    fn transfer_direct(env: &Env, order: &Order) {
        let token_client = token::TokenClient::new(env, &order.token);
        token_client.transfer(&order.payer, order.recipient.clone(), &order.amount);
    }

    fn emit_order_created(
        env: &Env,
        order_id: BytesN<32>,
        payer: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        deadline: u64,
    ) {
        OrderCreated {
            order_id,
            payer,
            recipient,
            token,
            amount,
            deadline,
        }
        .publish(env);
    }

    fn emit_order_paid(
        env: &Env,
        order_id: BytesN<32>,
        payer: Address,
        recipient: Address,
        token: Address,
        amount: i128,
    ) {
        OrderPaid {
            order_id,
            payer,
            recipient,
            token,
            amount,
        }
        .publish(env);
    }
}
