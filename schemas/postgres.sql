create table if not exists e_vote_user
(
    id                       uuid                  not null
    constraint e_vote_user_pk
    primary key,
    username                 varchar(255)          not null
    constraint e_vote_user_pk2
    unique,
    email                    varchar(255)          not null
    constraint e_vote_user_pk3
    unique,
    display_name             varchar(255),
    image                    varchar(255),
    password                 text,
    permission               varchar(255),
    token                    text,
    blocked                  boolean default false not null,
    activation_token         text,
    reset_token              text,
    partial_activation_token text
    );

alter table e_vote_user
    owner to postgres;

create table if not exists e_vote_election
(
    id         uuid                  not null
    constraint e_vote_election_pk
    primary key,
    title      varchar(255)          not null,
    start_date varchar(255)          not null,
    end_date   varchar(255)          not null,
    created_at varchar(255)          not null,
    results    text,
    pdf        text,
    xlsx       text,
    detection  boolean default false not null
    );

alter table e_vote_election
    owner to postgres;

create table if not exists e_vote_candidate
(
    election_id uuid         not null
    constraint e_vote_candidate_e_vote_election_id_fk
    references e_vote_election,
    id          uuid         not null
    constraint e_vote_candidate_pk
    primary key,
    name        varchar(255) not null,
    image       text
    );

alter table e_vote_candidate
    owner to postgres;

create table if not exists e_vote_manager
(
    user_id     uuid not null
    constraint e_vote_manager_e_vote_user_id_fk
    references e_vote_user,
    election_id uuid not null
    constraint e_vote_manager_e_vote_election_id_fk
    references e_vote_election
);

alter table e_vote_manager
    owner to postgres;

create table if not exists e_vote_voter
(
    user_id     uuid not null
    constraint e_vote_voter_e_vote_user_id_fk
    references e_vote_user,
    election_id uuid not null
    constraint e_vote_voter_e_vote_election_id_fk
    references e_vote_election,
    voted       varchar(255)
    );

alter table e_vote_voter
    owner to postgres;

create table if not exists e_vote_blacklist
(
    email varchar(255) not null
    );

alter table e_vote_blacklist
    owner to postgres;

create or replace procedure delete_user(IN user_id uuid)
    language sql
as
$$
DELETE FROM e_vote_user WHERE id = user_id;
$$;

alter procedure delete_user(uuid) owner to postgres;

create or replace procedure change_user_permission(IN user_id uuid, IN new_permission character varying)
    language sql
as
$$
UPDATE e_vote_user SET permission = new_permission WHERE id = user_id;
$$;

alter procedure change_user_permission(uuid, varchar) owner to postgres;

create or replace procedure insert_manager(IN manager_id uuid, IN election uuid)
    language sql
as
$$
    INSERT INTO e_vote_manager(user_id, election_id) VALUES (manager_id, election);
$$;

alter procedure insert_manager(uuid, uuid) owner to postgres;

create or replace procedure insert_voter(IN voter_id uuid, IN election uuid)
    language sql
as
$$
    INSERT INTO e_vote_voter(user_id, election_id) VALUES (voter_id, election);
$$;

alter procedure insert_voter(uuid, uuid) owner to postgres;

create or replace procedure delete_election(IN election_id uuid)
    language sql
as
$$
DELETE FROM e_vote_election WHERE id = election_id;
$$;

alter procedure delete_election(uuid) owner to postgres;

create or replace procedure delete_election_managers(IN election uuid)
    language sql
as
$$
DELETE FROM e_vote_manager WHERE election_id = election;
$$;

alter procedure delete_election_managers(uuid) owner to postgres;

create or replace procedure delete_election_candidates(IN election uuid)
    language sql
as
$$
DELETE FROM e_vote_candidate WHERE election_id = election;
$$;

alter procedure delete_election_candidates(uuid) owner to postgres;

create or replace procedure insert_candidate(IN candidate_id uuid, IN candidate_name character varying, IN candidate_image character varying, IN election uuid)
    language sql
as
$$
    INSERT INTO e_vote_candidate(id, name, image, election_id) VALUES (candidate_id, candidate_name, candidate_image, election);
$$;

alter procedure insert_candidate(uuid, varchar, varchar, uuid) owner to postgres;

create or replace procedure insert_election(IN election_id uuid, IN election_title character varying, IN startdate character varying, IN enddate character varying, IN createdat character varying)
    language sql
as
$$
    INSERT INTO e_vote_election(id, title, start_date, end_date, created_at) VALUES (election_id, election_title, startDate, endDate, createdAt);
$$;

alter procedure insert_election(uuid, varchar, varchar, varchar, varchar) owner to postgres;

create or replace procedure update_election(IN election_id uuid, IN new_title character varying, IN startdate character varying, IN enddate character varying)
    language sql
as
$$
UPDATE e_vote_election SET title = new_title, start_date = startDate, end_date = endDate WHERE id = election_id;
$$;

alter procedure update_election(uuid, varchar, varchar, varchar) owner to postgres;

create or replace procedure delete_candidate(IN candidate_id uuid)
    language sql
as
$$
DELETE FROM e_vote_candidate WHERE id = candidate_id;
$$;

alter procedure delete_candidate(uuid) owner to postgres;

create or replace procedure vote_submission(IN voter uuid, IN election uuid, IN vote_time character varying)
    language sql
as
$$
UPDATE e_vote_voter SET voted = vote_time WHERE user_id = voter AND election_id = election;
$$;

alter procedure vote_submission(uuid, uuid, varchar) owner to postgres;

create or replace procedure delete_election_voters(IN election uuid)
    language sql
as
$$
DELETE FROM e_vote_voter WHERE election_id = election;
$$;

alter procedure delete_election_voters(uuid) owner to postgres;

create or replace procedure insert_blacklisted_user(IN blacklisted_email character varying)
    language sql
as
$$
    INSERT INTO e_vote_blacklist(email) VALUES (blacklisted_email);
$$;

alter procedure insert_blacklisted_user(varchar) owner to postgres;

create or replace procedure block_user(IN user_id uuid)
    language sql
as
$$
UPDATE e_vote_user SET blocked = true WHERE id = user_id;
$$;

alter procedure block_user(uuid) owner to postgres;

create or replace procedure unblock_user(IN user_id uuid)
    language sql
as
$$
UPDATE e_vote_user SET blocked = false WHERE id = user_id;
$$;

alter procedure unblock_user(uuid) owner to postgres;

create or replace procedure verify_account(IN user_token text)
    language sql
as
$$
UPDATE e_vote_user SET activation_token = null WHERE activation_token = user_token;
$$;

alter procedure verify_account(text) owner to postgres;

create or replace procedure insert_user(IN id uuid, IN username character varying, IN email character varying, IN display_name character varying, IN image character varying, IN password text, IN permission character varying, IN token text, IN verification_token text)
    language sql
as
$$
    INSERT INTO e_vote_user(id, username, email, display_name, image, password, permission, token, activation_token) VALUES (id, username, email, display_name, image, password, permission, token, verification_token);
$$;

alter procedure insert_user(uuid, varchar, varchar, varchar, varchar, text, varchar, text, text) owner to postgres;

create or replace procedure insert_reset_token(IN user_email character varying, IN resettoken text)
    language sql
as
$$
UPDATE e_vote_user SET reset_token = resettoken WHERE email = user_email;
$$;

alter procedure insert_reset_token(varchar, text) owner to postgres;

create or replace procedure password_recovery(IN new_password text, IN resettoken text)
    language sql
as
$$
UPDATE e_vote_user SET password = new_password, reset_token = null WHERE reset_token = resettoken;
$$;

alter procedure password_recovery(text, text) owner to postgres;

create or replace procedure delete_blacklist()
    language sql
as
$$
DELETE FROM e_vote_blacklist;
$$;

alter procedure delete_blacklist() owner to postgres;

create or replace procedure insert_election_reports(IN election_id uuid, IN report_pdf text, IN report_xlsx text)
    language sql
as
$$
UPDATE e_vote_election SET pdf = report_pdf, xlsx = report_xlsx WHERE id = election_id;
$$;

alter procedure insert_election_reports(uuid, text, text) owner to postgres;

create or replace procedure partial_insert_user(IN user_id uuid, IN user_username character varying, IN user_email character varying, IN user_permission character varying, IN user_token text, IN user_activation_token text)
    language sql
as
$$
    INSERT INTO e_vote_user(id, username, email, permission, token, partial_activation_token) VALUES (user_id, user_username, user_email, user_permission, user_token, user_activation_token);
$$;

alter procedure partial_insert_user(uuid, varchar, varchar, varchar, text, text) owner to postgres;

create or replace procedure register_user(IN user_display_name character varying, IN user_password text, IN user_image text, IN user_activation_token text)
    language sql
as
$$
UPDATE e_vote_user SET display_name = user_display_name, password = user_password, image = user_image, partial_activation_token = null WHERE partial_activation_token = user_activation_token;
$$;

alter procedure register_user(varchar, text, text, text) owner to postgres;

create or replace procedure update_candidate(IN candidate_id uuid, IN candidate_name character varying, IN candidate_image character varying)
    language sql
as
$$
UPDATE e_vote_candidate SET name = candidate_name, image = candidate_image WHERE id = candidate_id;
$$;

alter procedure update_candidate(uuid, varchar, varchar) owner to postgres;

create or replace procedure insert_election_results(IN election_id uuid, IN election_results text, IN election_detection boolean)
    language sql
as
$$
UPDATE e_vote_election SET results = election_results, detection = election_detection WHERE id = election_id;
$$;

alter procedure insert_election_results(uuid, text, boolean) owner to postgres;

create or replace procedure remove_fraud(IN election_id uuid)
    language sql
as
$$
UPDATE e_vote_election SET detection = false WHERE id = election_id;
$$;

alter procedure remove_fraud(uuid) owner to postgres;

create or replace procedure update_user(IN user_id uuid, IN user_display_name character varying, IN user_password text, IN user_image character varying, IN user_token text)
    language sql
as
$$
UPDATE e_vote_user SET display_name = user_display_name, password = user_password, image = user_image, token = user_token WHERE id = user_id;
$$;

alter procedure update_user(uuid, varchar, text, varchar, text) owner to postgres;

