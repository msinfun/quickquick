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
              status: "confirmed"
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
    };

    processRules().catch(err => console.error("Recurring Processor Error:", err));
  }, []);
}
