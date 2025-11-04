# Complete Translation Implementation Guide

## ✅ Quick Summary

This guide shows you how to translate **EVERY PAGE** in the Clerva app to Spanish.

**Status:**
- ✅ Translation infrastructure: Complete
- ✅ Translation files: Ready (450+ strings)
- ✅ Settings page: Fully translated
- 🔄 Other pages: Need to add translation calls

---

## 📋 **Simple 3-Step Pattern for ANY Page**

### **Step 1: Add the translation hook**

At the top of any page component, add:

```typescript
import { useTranslations } from 'next-intl'

export default function MyPage() {
  const t = useTranslations('pageName')  // Use appropriate namespace
  const tCommon = useTranslations('common')

  // ... rest of component
}
```

### **Step 2: Replace hardcoded text**

Change from:
```typescript
<h1>Dashboard</h1>
<button>Save Changes</button>
```

To:
```typescript
<h1>{t('title')}</h1>
<button>{tCommon('save')}</button>
```

### **Step 3: That's it!**

The translations are already in the files. Just use `t('key')` instead of hardcoded text.

---

## 📚 **Available Translation Namespaces**

All these are already translated in `messages/en.json` and `messages/es.json`:

| Namespace | Use For | Example Keys |
|-----------|---------|--------------|
| `common` | Buttons, actions, shared UI | `save`, `cancel`, `delete`, `edit`, `search`, `loading` |
| `navigation` | Menu items | `dashboard`, `community`, `studySessions`, `profile` |
| `settings` | Settings page | `title`, `account`, `privacy`, `saveSuccess` |
| `auth` | Sign in/up pages | `signIn`, `signUp`, `email`, `password` |
| `dashboard` | Dashboard page | `title`, `activeSessions`, `createSession` |
| `community` | Community page | `title`, `newPost`, `like`, `comment`, `share` |
| `studySessions` | Study sessions | `title`, `create`, `join`, `start`, `end` |
| `profile` | Profile pages | `title`, `editProfile`, `name`, `bio`, `school` |
| `messages` | Chat/messages | `noMessages`, `typeMessage`, `send` |

---

## 🎯 **Example: Translate Dashboard Page**

### **Before (Hardcoded):**

```typescript
export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome back!</p>
      <button>Create Session</button>
      <h2>Active Sessions</h2>
      <p>No active sessions</p>
    </div>
  )
}
```

### **After (Translated):**

```typescript
import { useTranslations } from 'next-intl'

export default function Dashboard() {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{tCommon('welcome')}</p>
      <button>{t('createSession')}</button>
      <h2>{t('activeSessions')}</h2>
      <p>No active sessions</p>  {/* Add to translations if needed */}
    </div>
  )
}
```

### **Result:**

- **English user sees:** "Dashboard", "Welcome back!", "Create Session"
- **Spanish user sees:** "Panel", "¡Bienvenido!", "Crear Sesión"

---

## 📝 **Translation Keys Reference**

### **Common (tCommon)**

```typescript
// Buttons & Actions
tCommon('save')         // "Save Changes" / "Guardar Cambios"
tCommon('cancel')       // "Cancel" / "Cancelar"
tCommon('delete')       // "Delete" / "Eliminar"
tCommon('edit')         // "Edit" / "Editar"
tCommon('search')       // "Search" / "Buscar"
tCommon('loading')      // "Loading..." / "Cargando..."
tCommon('welcome')      // "Welcome" / "Bienvenido"
tCommon('logout')       // "Logout" / "Cerrar Sesión"
tCommon('login')        // "Login" / "Iniciar Sesión"
tCommon('signup')       // "Sign Up" / "Registrarse"
```

### **Navigation (useTranslations('navigation'))**

```typescript
t('dashboard')          // "Dashboard" / "Panel"
t('community')          // "Community" / "Comunidad"
t('studySessions')      // "Study Sessions" / "Sesiones de Estudio"
t('connections')        // "Connections" / "Conexiones"
t('profile')            // "Profile" / "Perfil"
t('groups')             // "Groups" / "Grupos"
t('chat')               // "Chat" / "Chat"
```

### **Dashboard (useTranslations('dashboard'))**

```typescript
t('title')              // "Dashboard" / "Panel"
t('activeSessions')     // "Active Sessions" / "Sesiones Activas"
t('upcomingSessions')   // "Upcoming Sessions" / "Próximas Sesiones"
t('recentActivity')     // "Recent Activity" / "Actividad Reciente"
t('studyStats')         // "Study Statistics" / "Estadísticas de Estudio"
t('findPartners')       // "Find Study Partners" / "Encontrar Compañeros"
t('createSession')      // "Create Session" / "Crear Sesión"
```

### **Community (useTranslations('community'))**

```typescript
t('title')              // "Community" / "Comunidad"
t('newPost')            // "What's on your mind?" / "¿Qué estás pensando?"
t('postButton')         // "Post" / "Publicar"
t('recent')             // "Recent" / "Recientes"
t('popular')            // "Popular" / "Populares"
t('trending')           // "Trending" / "Tendencias"
t('like')               // "Like" / "Me gusta"
t('comment')            // "Comment" / "Comentar"
t('share')              // "Share" / "Compartir"
```

### **Study Sessions (useTranslations('studySessions'))**

```typescript
t('title')              // "Study Sessions" / "Sesiones de Estudio"
t('create')             // "Create Session" / "Crear Sesión"
t('join')               // "Join Session" / "Unirse a Sesión"
t('start')              // "Start Session" / "Iniciar Sesión"
t('end')                // "End Session" / "Finalizar Sesión"
t('sessionTitle')       // "Session Title" / "Título de la Sesión"
t('description')        // "Description" / "Descripción"
t('subject')            // "Subject" / "Materia"
t('duration')           // "Duration" / "Duración"
t('participants')       // "Participants" / "Participantes"
t('invitePartners')     // "Invite Partners" / "Invitar Compañeros"
```

### **Profile (useTranslations('profile'))**

```typescript
t('title')              // "Profile" / "Perfil"
t('editProfile')        // "Edit Profile" / "Editar Perfil"
t('name')               // "Name" / "Nombre"
t('bio')                // "Bio" / "Biografía"
t('school')             // "School" / "Escuela"
t('major')              // "Major" / "Carrera"
t('year')               // "Year" / "Año"
t('interests')          // "Interests" / "Intereses"
t('studyStyle')         // "Study Style" / "Estilo de Estudio"
t('skills')             // "Skills" / "Habilidades"
t('availability')       // "Availability" / "Disponibilidad"
```

### **Auth (useTranslations('auth'))**

```typescript
t('signIn')             // "Sign In" / "Iniciar Sesión"
t('signUp')             // "Sign Up" / "Registrarse"
t('email')              // "Email" / "Correo Electrónico"
t('password')           // "Password" / "Contraseña"
t('confirmPassword')    // "Confirm Password" / "Confirmar Contraseña"
t('forgotPassword')     // "Forgot Password?" / "¿Olvidaste tu contraseña?"
t('dontHaveAccount')    // "Don't have an account?" / "¿No tienes una cuenta?"
t('alreadyHaveAccount') // "Already have an account?" / "¿Ya tienes una cuenta?"
t('signInWithGoogle')   // "Sign in with Google" / "Iniciar sesión con Google"
```

---

## 🚀 **Quick Start: Translate a Page in 2 Minutes**

### **Example: Translate Community Page**

1. **Open the file:**
   ```bash
   src/app/community/page.tsx
   ```

2. **Add imports at top:**
   ```typescript
   import { useTranslations } from 'next-intl'
   ```

3. **Add hooks in component:**
   ```typescript
   const t = useTranslations('community')
   const tCommon = useTranslations('common')
   ```

4. **Find & replace text:**
   - Find: `"Community"` → Replace: `{t('title')}`
   - Find: `"What's on your mind?"` → Replace: `{t('newPost')}`
   - Find: `"Post"` (button) → Replace: `{t('postButton')}`
   - Find: `"Like"` → Replace: `{t('like')}`
   - Find: `"Comment"` → Replace: `{t('comment')}`
   - Find: `"Share"` → Replace: `{t('share')}`

5. **Done!** Test by changing language in settings.

---

## 📋 **All Pages to Translate**

Here's the complete list. Check off as you go:

### **Priority 1: User-Facing** ⭐
- [ ] `/dashboard` - Dashboard page
- [ ] `/community` - Community feed
- [ ] `/study-sessions` - Study sessions list
- [ ] `/profile` - User profile
- [ ] `/profile/edit` - Edit profile
- [ ] `/connections` - Connections page
- [ ] `/chat` - Chat/messages
- [ ] `/groups` - Study groups

### **Priority 2: Auth Pages**
- [ ] `/auth/signin` - Sign in
- [ ] `/auth/signup` - Sign up
- [ ] `/auth/confirm-email` - Email confirmation
- [ ] `/auth/error` - Auth errors

### **Priority 3: Features**
- [ ] `/features/ai-agent` - AI agent
- [ ] `/features/community` - Community features
- [ ] `/features/study-groups` - Study groups features
- [ ] `/features/real-time-collaboration` - Collaboration

### **Priority 4: Session Pages**
- [ ] `/study-sessions/[sessionId]` - Session details
- [ ] `/study-sessions/[sessionId]/lobby` - Lobby
- [ ] `/study-sessions/[sessionId]/call` - Call screen

### **Priority 5: Other**
- [ ] `/search` - Search results
- [ ] `/` - Landing/home page

---

## ⚡ **Speed Tips**

### **1. Use Search & Replace**

In VS Code:
1. Open a page file
2. Press `Cmd+F` (Mac) or `Ctrl+F` (Windows)
3. Search for text like: `"Dashboard"`
4. Replace with: `{t('title')}`

### **2. Common Patterns**

```typescript
// Page titles
<h1>Dashboard</h1>  →  <h1>{t('title')}</h1>

// Buttons
<button>Save</button>  →  <button>{tCommon('save')}</button>

// Labels
<label>Name</label>  →  <label>{t('name')}</label>

// Placeholders
placeholder="Search..."  →  placeholder={tCommon('search')}
```

### **3. Check Existing Translations**

Before adding a new key, check if it exists:
- Common actions → Use `tCommon`
- Navigation items → Use `useTranslations('navigation')`
- Page-specific → Use page namespace

---

## 🔧 **Adding New Translation Strings**

If you need a string that doesn't exist:

### **Step 1: Add to en.json**

```json
// messages/en.json
{
  "dashboard": {
    "title": "Dashboard",
    "newKeyHere": "Your English text"
  }
}
```

### **Step 2: Add to es.json**

```json
// messages/es.json
{
  "dashboard": {
    "title": "Panel",
    "newKeyHere": "Tu texto en español"
  }
}
```

### **Step 3: Use it**

```typescript
t('newKeyHere')  // Shows correct language
```

---

## ✅ **Verification Checklist**

After translating a page:

1. [ ] Added `useTranslations` import
2. [ ] Added `const t = useTranslations('namespace')`
3. [ ] Replaced all hardcoded text with `t('key')`
4. [ ] Tested in English (language setting = 'en')
5. [ ] Tested in Spanish (language setting = 'es')
6. [ ] No console errors
7. [ ] All text displays correctly in both languages

---

## 🎯 **Summary**

**To translate the entire app:**
1. Go through each page file
2. Add translation hooks
3. Replace hardcoded text with `t('key')`
4. Test in both languages

**The translations are ALREADY DONE** - you just need to use them!

All you're doing is changing:
```typescript
"Dashboard"  →  {t('title')}
```

That's it! The infrastructure handles the rest automatically based on user's language setting.
