import { useState } from "react";

const STORAGE_KEY = "upa_nurse_name";

export function useNurse() {
  const [nurseName, setNurseNameState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? ""
  );

  const setNurseName = (name: string) => {
    const trimmed = name.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNurseNameState(trimmed);
  };

  return { nurseName, setNurseName };
}
