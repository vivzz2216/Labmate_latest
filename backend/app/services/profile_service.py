from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from ..models import User, UserProfile


def profile_is_complete(user, profile=None):
    profile = profile if profile is not None else getattr(user, 'profile', None)
    if profile is None or not str(getattr(user, 'name', '') or '').strip():
        return False
    meta = profile.profile_metadata or {}
    graduation = str(meta.get('graduation_year') or '').strip()
    roll = next((str(meta.get(key) or '').strip() for key in ('roll_number', 'usn', 'roll_no') if str(meta.get(key) or '').strip()), '')
    return bool(not meta.get('auto_generated') and str(profile.institution or '').strip()
                and str(profile.course or '').strip() and str(meta.get('year') or '').strip()
                and roll and graduation.isdigit() and len(graduation) == 4 and 2000 <= int(graduation) <= 2100)


def require_student_profile(user):
    from fastapi import HTTPException
    from ..security.operator_access import is_admin_user
    if not is_admin_user(user) and not profile_is_complete(user):
        raise HTTPException(428, 'Complete your student profile before lab execution. Your name, roll number, college, department and academic years are required.')


@dataclass
class UserProfileData:
    """Serializable view of a user's extended profile."""

    name: str
    age: Optional[int]
    course: Optional[str]
    institution: Optional[str]
    city: Optional[str]
    bio: Optional[str]
    metadata: Dict[str, Any]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "age": self.age,
            "course": self.course,
            "institution": self.institution,
            "city": self.city,
            "bio": self.bio,
            "metadata": self.metadata,
        }


class UserProfileService:
    """
    Provides helper methods to fetch or bootstrap extended user profile data.
    The service keeps defaults opinionated for academic assignments but stores
    them in the database so they can be customized later from the UI.
    """

    DEFAULT_PROFILE = {
        "age": 21,
        "course": "Computer Science and Engineering",
        "institution": "Government Engineering College",
        "city": "Thiruvananthapuram",
        "bio": "Meticulous engineering student who keeps submissions authentic.",
    }

    def get_or_create_profile(self, db: Session, user: User) -> UserProfileData:
        require_student_profile(user)
        profile = user.profile
        if not profile:
            profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

        if not profile:
            profile = UserProfile(
                user_id=user.id,
                profile_metadata={},
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        metadata = profile.profile_metadata or {}
        return UserProfileData(
            name=user.name,
            age=profile.age,
            course=profile.course or metadata.get("course_override"),
            institution=profile.institution or metadata.get("institution_override"),
            city=profile.city or metadata.get("city_override"),
            bio=profile.bio or metadata.get("bio_override"),
            metadata=metadata,
        )

