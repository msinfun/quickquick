import { useEffect } from 'react';
import { db, addTransaction } from '@/db/db';
import { calculateNextDate, getTodayStr } from '@/services/dateUtils';

export function useRecurringProcessor() {
  useEffect(() => {
    const processRules = async () => {
      const today = getTodayStr();
      const activeRules = await db.recurringRules
        .where('is_active')
        .equals(1 as any)
        .toArray();

      for (const rule of activeRules) {
        let currentDate = rule.next_generation_date;
        let installmentsPaid = rule.installments_paid || 0;
        let updatedRule = false;

        while (currentDate <= today && rule.is_active) {
          // Generate transaction(s) from template
          const template = rule.template_transaction;
          const items = (template as any).items || [];
          
          const groupId = items.length > 1 ? crypto.randomUUID() : undefined;
          
          for (const item of items) {
            await addTransaction({
              ...item,
              date: currentDate,
              group_id: groupId,
              rule_id: rule.id,
              status: "pending"
            } as any);
          }

          // Update tracking
          installmentsPaid++;
          currentDate = calculateNextDate(currentDate, rule.frequency);
          updatedRule = true;

          // Check for completion
          if (rule.type === 'installment' && rule.total_installments && installmentsPaid >= rule.total_installments) {
            await db.recurringRules.update(rule.id!, {
              is_active: false,
              installments_paid: installmentsPaid,
              last_generated_date: rule.next_generation_date, // The date we just processed
              next_generation_date: currentDate
            });
            break;
          }
        }

        if (updatedRule && rule.is_active) {
          await db.recurringRules.update(rule.id!, {
            installments_paid: installmentsPaid,
            last_generated_date: today,
            next_generation_date: currentDate
          });
        }
      }

      // --- Credit Card Auto-Pay Logic ---
      const creditCardAccounts = await db.accounts
        .where('type')
        .equals('credit_card')
        .filter(acc => !!acc.auto_pay_enabled && !!acc.auto_pay_from_account_id)
        .toArray();

      for (const card of creditCardAccounts) {
        const [y, m, d] = today.split('/').map(Number);
        
        // Calculate payment date for THIS month
        // In most cases, payment is due on payment_due_day of current month
        // The billing cycle is billing_cycle.
        const payDate = new Date(y, m - 1, card.payment_due_day || 15);
        const payDateStr = payDate.toISOString().split('T')[0].replace(/-/g, '/');
        
        // Only trigger if today is payment day or after
        if (today >= payDateStr) {
          // Identify the billing month we are paying for. 
          // Usually auto-pay pays off the balance from the PREVIOUS cycle.
          // For simplicity, we check if we've already made an "Auto-Pay" transfer to this card this month.
          const currentMonthPrefix = `${y}/${String(m).padStart(2, '0')}`;
          
          const existingPayment = await db.transactions
            .where('account_id')
            .equals(card.id!)
            .filter(tx => 
              tx.type === 'transfer' && 
              tx.date.startsWith(currentMonthPrefix) &&
              tx.note?.includes('自動轉帳付款') === true
            )
            .first();

          if (!existingPayment) {
            // Need to pay!
            // Calculate current balance of the card (it's usually negative for credit cards)
            // If balance is >= 0, no need to pay.
            if (card.current_balance < 0) {
              const amountToPay = Math.abs(card.current_balance);
              const sourceAccountId = card.auto_pay_from_account_id!;

              await db.transaction('rw', [db.transactions, db.accounts], async () => {
                // 1. Transaction on source account (expense-like transfer)
                await addTransaction({
                  date: today,
                  type: 'transfer',
                  main_category: '轉帳',
                  sub_category: '帳單付款',
                  account_id: sourceAccountId,
                  amount: -amountToPay,
                  item_name: `信用卡自動扣款 (${card.name})`,
                  status: 'confirmed',
                  note: `自動轉帳付款至 ${card.name}`
                });

                // 2. Transaction on card account (income-like transfer)
                await addTransaction({
                  date: today,
                  type: 'transfer',
                  main_category: '轉帳',
                  sub_category: '帳單付款',
                  account_id: card.id,
                  amount: amountToPay,
                  item_name: `信用卡自動扣款 (${card.name})`,
                  status: 'confirmed',
                  note: `自動轉帳付款自其他帳戶`
                });
              });
              
              console.log(`Auto-paid ${amountToPay} for ${card.name}`);
            }
          }
        }
      }
    };

    processRules().catch(err => console.error("Recurring Processor Error:", err));
  }, []);
}
