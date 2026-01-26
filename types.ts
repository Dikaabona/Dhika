
export interface Employee {
  id: string;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  noKtp: string;
  noHandphone: string;
  tanggalMasuk: string;
  bank: string;
  noRekening: string;
  namaDiRekening: string;
  avatarUrl?: string; // Standard placeholder
  photoBase64?: string; // Real uploaded photo
}

export type SortField = 'nama' | 'tanggalMasuk' | 'bank';
export type SortOrder = 'asc' | 'desc';

export interface AppState {
  employees: Employee[];
  searchQuery: string;
  isFormOpen: boolean;
  editingEmployee: Employee | null;
  aiAnalyzing: boolean;
}

export interface SalaryData {
  month: string;
  year: string;
  gapok: number;
  tunjanganMakan: number;
  tunjanganTransport: number;
  tunjanganKomunikasi: number;
  bpjstk: number;
  lembur: number;
  bonus: number;
}
