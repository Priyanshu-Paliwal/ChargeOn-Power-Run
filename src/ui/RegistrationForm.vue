<script setup>
import { reactive, ref, onMounted, onUnmounted, nextTick, computed } from "vue";
import { CHARACTERS } from "../game/config/GameConfig.js";
import { checkEmailExists } from "../services/FirebaseService.js";

const props = defineProps({
  characterId: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["cancel", "submit"]);

const characterImage = computed(() => {
  const char = CHARACTERS.find((c) => c.id === props.characterId);
  return char?.images?.registration || "/img/1-1-game.png";
});

const formData = reactive({
  name: "",
  company: "",
  email: "",
});

const nameInputEl = ref(null);

const handleKeyDown = (e) => {
  if (e.key === "Escape") {
    emit("cancel");
  } else if (e.key === "Enter") {
    // Allow fake "Enter" keydown from gamepad to submit the form
    handleSubmit(e);
  }
};

onMounted(() => {
  setTimeout(() => {
    nameInputEl.value?.focus();
    nameInputEl.value?.select?.();
  }, 100);
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});

// Per-field, not a single shared line -- exact wording from
// docs/ChargeOn_Power_Run_Content_Script, section 2.2 "Validation / error
// messages". Do not reword these; if a case needs copy this document
// doesn't cover, flag it to marketing rather than inventing new text.
const errors = reactive({ name: "", company: "", email: "" });
const isSubmitting = ref(false);

const VALIDATORS = {
  name: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Enter your name to continue.";
    // Must have at least 2 words separated by a space
    if (!/^[A-Za-z]+([ '-][A-Za-z]+)+$/.test(trimmed))
      return "Please enter your full name (first and last name, letters only).";
    return "";
  },
  company: (v) => {
    if (!v.trim()) return "Enter your company name to continue.";
    return "";
  },
  email: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Enter your email to continue.";
    // RFC-compliant email: no leading/trailing spaces, no #* etc., must have @domain.tld
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(trimmed))
      return "That email doesn't look right. Check it and try again.";

    // Block public domains
    const publicDomains = [
      "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", 
      "live.com", "icloud.com", "aol.com", "mail.com"
    ];
    const domain = trimmed.split('@')[1].toLowerCase();
    if (publicDomains.includes(domain)) {
      return "Please enter a valid company email. Public domains are not allowed.";
    }
    
    return "";
  },
};

function validateField(field) {
  errors[field] = VALIDATORS[field](formData[field]);
  return !errors[field];
}

// Keeps the focused field visible above the on-screen keyboard on mobile.
// A short delay lets the keyboard finish animating in first -- scrolling
// immediately on focus computes against the pre-keyboard viewport height
// and can undershoot.
function scrollIntoViewOnFocus(e) {
  setTimeout(() => {
    e.target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 300);
}

const handleSubmit = async (e) => {
  e.preventDefault();
  const allValid = ["name", "company", "email"]
    .map(validateField)
    .every(Boolean);
  if (!allValid) return;

  isSubmitting.value = true;
  
  // Check if email already exists in Firebase
  const emailExists = await checkEmailExists(formData.email.trim());
  if (emailExists) {
    errors.email = "This email has already been used to play.";
    isSubmitting.value = false;
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  emit("submit", {
    name: formData.name.trim(),
    company: formData.company.trim(),
    email: formData.email.trim(),
  });
};
</script>

<template>
  <div class="registration-overlay">
    <img :src="characterImage" alt="Character" class="form-character-img" />
    <div class="form-container">
      <div class="header">
        <h2>Let's Get you <span class="highlight">Running</span></h2>
        <p>Enter your details to start the game</p>
      </div>

      <form @submit="handleSubmit" novalidate>
        <div class="input-group" :class="{ 'has-error': errors.name }">
          <label>Full Name <span class="required">*</span></label>
          <input
            ref="nameInputEl"
            type="text"
            v-model="formData.name"
            placeholder="Enter Name Here"
            :disabled="isSubmitting"
            @blur="validateField('name')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.name" class="field-error-msg">{{
              errors.name
            }}</span>
          </Transition>
        </div>

        <div class="input-group" :class="{ 'has-error': errors.company }">
          <label>Company Name <span class="required">*</span></label>
          <input
            type="text"
            v-model="formData.company"
            placeholder="Enter Name Here"
            :disabled="isSubmitting"
            @blur="validateField('company')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.company" class="field-error-msg">{{
              errors.company
            }}</span>
          </Transition>
        </div>

        <div class="input-group" :class="{ 'has-error': errors.email }">
          <label>Company Email <span class="required">*</span></label>
          <input
            type="email"
            v-model="formData.email"
            placeholder="Enter Name Here"
            :disabled="isSubmitting"
            @blur="validateField('email')"
            @focus="scrollIntoViewOnFocus"
          />
          <Transition name="field-error">
            <span v-if="errors.email" class="field-error-msg">{{
              errors.email
            }}</span>
          </Transition>
        </div>

        <div class="action-group">
          <button
            type="button"
            class="btn-secondary"
            :disabled="isSubmitting"
            @click="emit('cancel')"
          >
            Back
          </button>
          <button type="submit" class="btn-primary" :disabled="isSubmitting">
            <span v-if="!isSubmitting">START RUN</span>
            <span v-else class="submitting"
              ><span class="spinner"></span>Starting...</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.registration-overlay {
  width: 100%;
  height: 100%;
  /* Match Landing page dark shade gradient at top and bottom */
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 30%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 30%);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "Poppins", sans-serif;
  padding: 20px;
  overflow-y: auto;
}

.form-container {
  background: linear-gradient(
    135deg,
    rgb(0 0 0 / 65%) 0%,
    rgb(0 0 0 / 5%) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow:
    0px 4px 45px 0px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgb(0 0 0 / 50%);
  border-radius: 10px;
  padding: 40px;
  width: 100%;
  max-width: 480px;
  position: relative; /* important for absolute child */
  overflow: visible; /* so character can pop out */
}

.form-character-img {
  position: absolute;
  left: 0;
  bottom: 0;
  height: auto;
  width: 40%;
  z-index: 10;
  pointer-events: none;
  filter: drop-shadow(0px 10px 20px rgba(0, 0, 0, 0.5));
}

.header {
  margin-bottom: 40px;
}

.header h2 {
  font-family: "Goldman", sans-serif;
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: #fff;
  display: flex;
  gap: 10px;
  text-transform: none; /* Prevent global uppercase */
}

.header h2 .highlight {
  font-family: "Goldman", sans-serif;
  color: #ffd164;
}

.header p {
  color: #fff;
  font-size: 1rem;
  margin: 0;
}

.input-group {
  margin-bottom: 20px;
}
.input-group label {
  display: block;
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 8px;
  color: #fff;
  font-family: "Poppins", sans-serif;
}
.required {
  color: #e74c3c;
}
.input-group input {
  width: 100%;
  background: rgba(255, 255, 255, 0.35); /* frosted input */
  border: none;
  border-radius: 8px;
  padding: 12px 15px;
  color: #fff;
  font-family: "Poppins", sans-serif;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s;
}
.input-group input::placeholder {
  color: rgba(255, 255, 255, 0.8);
}
.input-group input:focus {
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(255, 209, 100, 0.5);
}
.input-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-group.has-error label {
  color: #ff5443;
}
.input-group.has-error input {
  border-color: #ff5443;
  background: rgb(199 123 115 / 43%);
}
.input-group.has-error input:focus {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.15);
}

.field-error-msg {
  display: block;
  color: #ff3622;
  font-size: 0.82rem;
  margin-top: 6px;
}

.field-error-enter-active {
  transition: all 0.2s ease-out;
}
.field-error-leave-active {
  transition: all 0.15s ease-in;
}
.field-error-enter-from,
.field-error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.action-group {
  display: flex;
  gap: 20px;
  justify-content: flex-end;
  align-items: center;
  margin-top: 10px;
}

.btn-secondary {
  flex: none;
  background: transparent;
  color: #fff;
  border: none;
  font-family: "Goldman", sans-serif;
  font-size: 1.2rem;
  font-weight: 400;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
  padding: 0 10px;
}
.btn-secondary:hover:not(:disabled) {
  color: #ffd164;
}
.btn-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-primary {
  flex: none;
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 14px 35px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #81b4e9 0%, #1a71cd 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.submitting {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .form-container {
    padding: 20px;
    margin: 10px;
  }
}

@media (max-width: 600px) {
  .header h2 {
    font-size: 1.8rem;
  }

  .action-group {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    padding: 12px;
  }
}

@media (max-height: 750px) {
  .form-container {
    padding: 15px 20px;
  }
  .header {
    margin-bottom: 15px;
  }
  .header h2 {
    font-size: 1.5rem;
    margin-bottom: 5px;
  }
  .input-group {
    margin-bottom: 10px;
  }
  .input-group input {
    padding: 8px 12px;
  }
}

/* Short-landscape: the form must stay fully usable with the on-screen
   keyboard open, which on a rotated phone can cover well over half the
   remaining height -- shrink everything and let the container scroll
   rather than clip.

   NOTE ON :global() SYNTAX (found and fixed this session -- see
   docs/PROCESS_TRACKER.md): :global(A) B compiles to just `A { ... }`,
   silently DROPPING `B` entirely -- confirmed directly against the real
   @vue/compiler-sfc, not assumed. Every rule below used that broken form,
   meaning this whole phone-landscape Registration treatment has been a
   complete no-op since Milestone 8. The whole selector (ancestor AND
   descendant together) must go inside ONE :global(...) call instead. */
:global(html[data-size-class="phone-landscape"] .registration-overlay) {
  align-items: flex-start;
  padding: 10px;
}
:global(html[data-size-class="phone-landscape"] .form-container) {
  padding: 14px 18px;
}
:global(html[data-size-class="phone-landscape"] .logo-wrap img) {
  height: 26px;
}
:global(html[data-size-class="phone-landscape"] .header) {
  margin-bottom: 8px;
}
:global(html[data-size-class="phone-landscape"] .header h2) {
  font-size: 1.2rem;
  margin-bottom: 2px;
}
:global(html[data-size-class="phone-landscape"] .header p) {
  font-size: 0.8rem;
}
:global(html[data-size-class="phone-landscape"] .input-group) {
  margin-bottom: 8px;
}
:global(html[data-size-class="phone-landscape"] .input-group input) {
  padding: 8px 12px;
}
</style>
