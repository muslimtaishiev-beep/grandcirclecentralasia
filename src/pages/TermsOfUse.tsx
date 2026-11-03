import LegalDocPage from "../components/public/LegalDocPage";
import { termsOfUse } from "../shared/legalDocs";

export default function TermsOfUse() {
  return <LegalDocPage kind="terms" title="Пользовательское соглашение" build={termsOfUse} />;
}
