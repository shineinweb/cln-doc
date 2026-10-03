import userManual from '../docs/user-manual.md?raw';
import sop from '../docs/sop.md?raw';
import { MarkdownView } from '../docs/MarkdownView';

export function UserManualPage() {
  return <MarkdownView source={userManual} testId="user-manual" />;
}

export function SopPage() {
  return <MarkdownView source={sop} testId="sop" />;
}
