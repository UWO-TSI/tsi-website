/**
 * The applicant island's creator studio (ledger row 334): recruitment's own cream classes and button, handed to the game's
 * CharacterCreator (`applicant`), so the island's creator looks exactly as it always has while the member game's is flat.
 */
import type { ApplicantStudio } from "@/components/game/character/creatorStudio";
import { VillageButton } from "./ui";
import styles from "./applicantCreator.module.css";

export const APPLICANT_STUDIO: ApplicantStudio = { styles, Button: VillageButton };
