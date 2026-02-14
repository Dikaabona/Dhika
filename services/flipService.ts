
import { supabase } from '../App';

// Catatan Keamanan: API Key Flip harus diletakkan di Supabase Secrets/Edge Functions.
// Kode ini adalah jembatan (client helper) untuk memanggil fungsi backend tersebut.

export const flipService = {
  /**
   * Cek Nama Rekening (Inquiry)
   */
  async inquiry(bankCode: string, accountNumber: string) {
    try {
      const { data, error } = await supabase.functions.invoke('flip-inquiry', {
        body: { bank_code: bankCode, account_number: accountNumber }
      });
      if (error) throw error;
      return data; // { status: 'SUCCESS', name: '...' }
    } catch (e) {
      console.error("Flip Inquiry Error:", e);
      return null;
    }
  },

  /**
   * Eksekusi Pembayaran Gaji (Disbursement)
   */
  async disburse(payload: {
    amount: number;
    bank_code: string;
    account_number: string;
    remark: string;
    recipient_city?: string;
  }) {
    try {
      const { data, error } = await supabase.functions.invoke('flip-disburse', {
        body: payload
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Flip Disburse Error:", e);
      throw e;
    }
  },

  /**
   * Cek Saldo Deposit Flip
   */
  async getBalance() {
    try {
      const { data, error } = await supabase.functions.invoke('flip-get-balance');
      if (error) throw error;
      return data.balance;
    } catch (e) {
      return 0;
    }
  }
};
