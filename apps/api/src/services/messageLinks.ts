import { ICustomer } from '../models/Customer';
import { ISettings } from '../models/Settings';
import { formatDateForWA } from '../utils/phone';

export interface ReminderLinks {
  message: string;
  whatsappUrl: string;
  smsUrl: string;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// Strip leading '+' for wa.me; keep '+' for the sms: scheme (most platforms prefer it).
function digitsOnly(phone: string): string {
  return phone.replace(/^\+/, '').replace(/\D/g, '');
}

export function buildReminderLinks(customer: ICustomer, settings: ISettings): ReminderLinks {
  const meds = customer.medicines.map(m => m.medicineName).join(', ');
  const message = renderTemplate(settings.messageTemplateReminder, {
    name: customer.name,
    pharmacyName: settings.pharmacyName,
    medicines: meds,
    dueDate: formatDateForWA(customer.nextDueDate),
  });
  const encoded = encodeURIComponent(message);
  const waDigits = digitsOnly(customer.phone);
  return {
    message,
    whatsappUrl: waDigits ? `https://wa.me/${waDigits}?text=${encoded}` : '',
    smsUrl: customer.phone ? `sms:${customer.phone}?body=${encoded}` : '',
  };
}

export function buildThankYouLinks(
  customer: ICustomer,
  settings: ISettings,
  nextDueDate: Date
): ReminderLinks {
  const meds = customer.medicines.map(m => m.medicineName).join(', ');
  const message = renderTemplate(settings.messageTemplateThankYou, {
    name: customer.name,
    pharmacyName: settings.pharmacyName,
    medicines: meds,
    nextDueDate: formatDateForWA(nextDueDate),
  });
  const encoded = encodeURIComponent(message);
  const waDigits = digitsOnly(customer.phone);
  return {
    message,
    whatsappUrl: waDigits ? `https://wa.me/${waDigits}?text=${encoded}` : '',
    smsUrl: customer.phone ? `sms:${customer.phone}?body=${encoded}` : '',
  };
}
