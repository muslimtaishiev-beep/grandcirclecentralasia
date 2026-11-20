import { Link, useParams } from "react-router-dom";
import { EmptyState, Button } from "../../components/ui";

/** Неизвестный адрес внутри кабинета — вместо пустого экрана. */
export default function WorkspaceNotFound() {
  const { orgId } = useParams();
  return (
    <EmptyState
      className="py-20"
      title="Страница не найдена"
      action={<Link to={`/workspace/${orgId || ""}`}><Button variant="primary">На главную</Button></Link>}
    />
  );
}
