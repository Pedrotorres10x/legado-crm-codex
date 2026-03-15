
-- Chat channels table
CREATE TABLE public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_direct boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- Chat channel members table
CREATE TABLE public.chat_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is member of channel
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  )
$$;

-- RLS: chat_channels - members can view their channels
CREATE POLICY "Members can view their channels"
ON public.chat_channels FOR SELECT TO authenticated
USING (public.is_channel_member(auth.uid(), id));

-- Admins can create public channels
CREATE POLICY "Admins can create public channels"
ON public.chat_channels FOR INSERT TO authenticated
WITH CHECK (
  (is_direct = false AND public.has_role(auth.uid(), 'admin')) OR
  (is_direct = true AND auth.uid() = created_by)
);

-- RLS: chat_channel_members
CREATE POLICY "Members can view channel members"
ON public.chat_channel_members FOR SELECT TO authenticated
USING (public.is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Admins can insert members"
ON public.chat_channel_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  (SELECT is_direct FROM public.chat_channels WHERE id = channel_id) = true
);

CREATE POLICY "Users can update own membership"
ON public.chat_channel_members FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- RLS: chat_messages
CREATE POLICY "Members can view channel messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Members can send messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  public.is_channel_member(auth.uid(), channel_id)
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger: auto-add new users to General channel
CREATE OR REPLACE FUNCTION public.auto_join_general_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  general_id uuid;
BEGIN
  SELECT id INTO general_id FROM public.chat_channels WHERE name = 'General' AND is_direct = false LIMIT 1;
  IF general_id IS NOT NULL THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id)
    VALUES (general_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_profile_join_general
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_general_channel();
