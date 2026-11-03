import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useSession } from "./session";
import { translate, type Language } from "./copy";

const Context = createContext<{
  language: Language;
  setGuestLanguage: (language: Language) => void;
  text: (value: string) => string;
} | null>(null);
export function LanguageProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [guestLanguage, setGuestLanguage] = useState<Language>("en");
  const language = user?.preferred_language ?? guestLanguage;
  useEffect(() => {
    if (user) setGuestLanguage(user.preferred_language);
  }, [user?.preferred_language]);
  return (
    <Context.Provider
      value={{
        language,
        setGuestLanguage,
        text: (value) => translate(language, value),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCopy() {
  const value = useContext(Context);
  if (!value) throw new Error("Use the language provider.");
  return value;
}
