# Context Policy v3.0

**Owner:** progressive-context

Context serves the current decision and follows the mandatory order:

`metadata → applicable Skill → necessary references`

Load metadata first to identify phase, authorization, artifact and status. Load exactly one applicable Skill next. Load only references declared by that Skill and requested by the current case. An undeclared or unrequested reference must not be loaded.

The current instruction and authorization precede the canonical artifact; real state and evidence override reports. Initial assurance uses an independent session, while follow-up assurance resumes its original session. Context is minimized without omitting a material control.
