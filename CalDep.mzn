% Constants
int: number_of_teams;
int: min_for_permanency_or_tour;
int: max_for_permanency_or_tour;
int: number_of_dates = (2*(number_of_teams-1));

set of int: teams_in_negative = -1*number_of_teams..-1;
set of int: teams = 1..number_of_teams;
set of int: dates = 1..number_of_dates;
set of int: calendar_values = teams_in_negative union teams;

array[teams,teams] of int: distance_per_team ;


% Decision variables
array [dates, teams] of var calendar_values: calendar_of_matches;

% Constraints

% a team plays against other team in a date as local only and only if the other team plays as visitor
constraint forall(date in dates, team in teams)( 
      if calendar_of_matches[date,team] > 0 then 
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team*-1 
      
      else
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team
     
      endif
);


% for all dates half the matches are local and half visitors
constraint forall(date in dates)(
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == 
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams_in_negative)) /\
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == number_of_teams/2
);

% for each team there has to be two dates, one in which a team plays as local and other where it plays as visitor for all other teams
constraint forall(team in teams)(
      forall(k in teams where k != team)(
            exists(date_one in dates, date_two in dates)(
              calendar_of_matches[date_one,team] == k /\ calendar_of_matches[date_two,team] == -1*k
            )
      )
);

% each team is in a permanency or team wich is greater or equal to the min_for_permanency_or_tour
constraint forall(team in teams, date in dates)(
    exists(leftLimit in dates, rightLimit in dates where leftLimit <= date /\ rightLimit >= date)(
        rightLimit - leftLimit + 1 >= min_for_permanency_or_tour
        /\
        forall(value in leftLimit..rightLimit)(
          calendar_of_matches[value, team] > 0
        )  
        \/
        forall(value in leftLimit..rightLimit)(
          calendar_of_matches[value, team] < 0
        )
    )
);

% for a team there is no permanency or tour that are greater than the max 
constraint forall(team in teams)(
    not exists(
      leftLimit in dates, 
      rightLimit in dates where 
      leftLimit <= rightLimit /\
      (
        forall(value in leftLimit..rightLimit)(
            calendar_of_matches[value, team] > 0
        )
        \/
        forall(value in leftLimit..rightLimit)(
            calendar_of_matches[value, team] < 0
        )
      )
    )
    (
        rightLimit - leftLimit + 1 > max_for_permanency_or_tour
    )    
);

% in two consecutives dates there cannot be the same match
constraint forall(date in 1..number_of_dates-1, team in teams)( 
     abs(calendar_of_matches[date,team]) != abs(calendar_of_matches[date+1,team])
);


% Objective
var int: expenses; 

constraint expenses = sum(date in 0..number_of_dates, team in teams)(
  if date == 0 then % before first row
       if calendar_of_matches[date+1,team] < 0 then % from local to visitor
        distance_per_team[abs(calendar_of_matches[date+1,team]),team] 
       else
          distance_per_team[team,team] 
       endif
  elseif date == number_of_dates then %last row
       if calendar_of_matches[date,team] < 0 then   % from visitor to local
          distance_per_team[team,abs(calendar_of_matches[date,team])] 
       else
          distance_per_team[team,team] 
       endif
  elseif calendar_of_matches[date,team] > 0 /\ calendar_of_matches[date+1,team] < 0 then % from local to visitor
    distance_per_team[abs(calendar_of_matches[date+1,team]),team]
   
  elseif calendar_of_matches[date,team] < 0 /\ calendar_of_matches[date+1,team] < 0 then % from visitor to visitor
    distance_per_team[abs(calendar_of_matches[date+1,team]),abs(calendar_of_matches[date,team])]
    
  elseif calendar_of_matches[date,team] < 0 /\ calendar_of_matches[date+1,team] > 0 then % from visitor to local
    distance_per_team[team,abs(calendar_of_matches[date,team])] 
  else
    distance_per_team[team,team] 
  endif 
);

solve minimize expenses;
         
