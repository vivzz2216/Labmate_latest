from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from ..models import User, UserProfile


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
        profile = user.profile
        if not profile:
            profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

        if not profile:
            profile = UserProfile(
                user_id=user.id,
                age=self.DEFAULT_PROFILE["age"],
                course=self.DEFAULT_PROFILE["course"],
                institution=self.DEFAULT_PROFILE["institution"],
                city=self.DEFAULT_PROFILE["city"],
                bio=self.DEFAULT_PROFILE["bio"],
                profile_metadata={"auto_generated": True},
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

