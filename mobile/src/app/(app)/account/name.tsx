import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSession } from '@/auth/session';
import { Field } from '@/components/Field';
import { EditScreen, useSaveProfile } from '@/features/profile/EditScreen';
import { limits, nameError } from '@/features/registration/validation';

export default function EditName() {
  const router = useRouter();
  const current = useSession((session) => session.user?.displayName ?? '');
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveProfile(() => router.back());

  const submit = () => {
    const found = nameError(name);
    setError(found);
    if (found) {
      return;
    }

    if (name.trim() === current) {
      router.back();
    } else {
      save.mutate({ displayName: name.trim() });
    }
  };

  return (
    <EditScreen title="Name" onAction={submit} busy={save.isPending} error={save.error} testID="edit-name">
      <Field
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        error={error}
        autoFocus
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={limits.name}
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="edit-name-field"
      />
    </EditScreen>
  );
}
