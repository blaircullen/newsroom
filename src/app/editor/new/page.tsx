import { redirect } from 'next/navigation';

export default async function NewEditorRedirect() {
  redirect('/editor');
}
