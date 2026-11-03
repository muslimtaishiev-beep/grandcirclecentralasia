import LegalDocPage from "../components/public/LegalDocPage";
import { privacyPolicy } from "../shared/legalDocs";

export default function PrivacyPolicy() {
  return <LegalDocPage kind="privacy" title="Политика конфиденциальности и обработки персональных данных" build={privacyPolicy} />;
}
