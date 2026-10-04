import userManual from '../../../../packages/guides/user-manual.md?raw';
import sop from '../../../../packages/guides/sop.md?raw';
import { MarkdownView } from '../docs/MarkdownView';

export function UserManualPage() {
  return <MarkdownView source={userManual} testId="user-manual" searchLabel="Search the user manual" />;
}

export function SopPage() {
  return <MarkdownView source={sop} testId="sop" searchLabel="Search operating procedures" />;
}
