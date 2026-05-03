import { createContext, useContext, useState } from "react";
import type { FeatureKey } from "./features";
import { FEATURES_DEFAULTS } from "./features";

type FeaturesState = Record<FeatureKey, boolean>;

interface FeaturesContextValue {
  features: FeaturesState;
  featureAtiva: (f: FeatureKey) => boolean;
  toggleFeature: (f: FeatureKey) => void;
}

const STORAGE_KEY = "upa_features";

function loadFromStorage(): FeaturesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FEATURES_DEFAULTS };
    return { ...FEATURES_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...FEATURES_DEFAULTS };
  }
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: { ...FEATURES_DEFAULTS },
  featureAtiva: (f) => FEATURES_DEFAULTS[f],
  toggleFeature: () => {},
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<FeaturesState>(loadFromStorage);

  function toggleFeature(nome: FeatureKey) {
    setFeatures(prev => {
      const next = { ...prev, [nome]: !prev[nome] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function featureAtiva(f: FeatureKey): boolean {
    return features[f] === true;
  }

  return (
    <FeaturesContext.Provider value={{ features, featureAtiva, toggleFeature }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
